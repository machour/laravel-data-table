<?php

namespace Machour\DataTable;

use Machour\DataTable\Columns\Column;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Spatie\LaravelData\Data;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
abstract class AbstractDataTable extends Data
{
    protected static int $defaultPerPage = 25;

    /**
     * @return array<int, Column>
     */
    abstract public static function tableColumns(): array;

    /**
     * @return array<int, QuickView>
     */
    public static function tableQuickViews(): array
    {
        return [];
    }

    abstract public static function tableBaseQuery(): Builder;

    public static function tableDefaultSort(): string
    {
        return '-id';
    }

    public static function filterParamName(): string
    {
        return 'filter';
    }

    /**
     * Compute footer aggregations for the current page of data.
     *
     * @param  \Illuminate\Support\Collection  $items  Collection of DTO instances for current page
     * @return array<string, mixed>  Column ID => aggregated value
     */
    public static function tableFooter(\Illuminate\Support\Collection $items): array
    {
        return [];
    }

    /**
     * @return array<int, AllowedFilter|string>
     */
    public static function tableAllowedFilters(): array
    {
        return collect(static::tableColumns())
            ->filter(fn (Column $col) => $col->filterable)
            ->map(fn (Column $col) => $col->id)
            ->values()
            ->all();
    }

    /**
     * @return array<int, AllowedSort|string>
     */
    public static function tableAllowedSorts(): array
    {
        return collect(static::tableColumns())
            ->filter(fn (Column $col) => $col->sortable)
            ->map(fn (Column $col) => $col->id)
            ->values()
            ->all();
    }

    public static function makeTable(?Request $request = null): DataTableResponse
    {
        $request = $request ?? request();
        $filterParam = static::filterParamName();

        $queryRequest = $request;
        if ($filterParam !== 'filter') {
            $queryRequest = clone $request;
            $queryRequest->query->set('filter', $request->get($filterParam, []));
        }

        $query = QueryBuilder::for(static::tableBaseQuery(), $queryRequest)
            ->allowedFilters(static::tableAllowedFilters())
            ->allowedSorts(static::tableAllowedSorts())
            ->defaultSort(static::tableDefaultSort());

        $perPage = (int) $request->get('per_page', static::$defaultPerPage);
        $paginator = $query->paginate($perPage)->withQueryString();

        $data = static::collect($paginator->items());

        $sorts = [];
        $sortParam = $request->get('sort', '');
        if ($sortParam) {
            foreach (explode(',', $sortParam) as $s) {
                $s = trim($s);
                if (! $s) {
                    continue;
                }
                $direction = 'asc';
                if (str_starts_with($s, '-')) {
                    $s = ltrim($s, '-');
                    $direction = 'desc';
                }
                $sorts[] = ['id' => $s, 'direction' => $direction];
            }
        }

        $quickViews = collect(static::tableQuickViews())->map(function (QuickView $qv) use ($request, $filterParam) {
            $active = static::quickViewMatchesRequest($qv, $request, $filterParam);

            return new QuickView(
                id: $qv->id,
                label: $qv->label,
                params: $qv->params,
                icon: $qv->icon,
                active: $active,
                columns: $qv->columns,
            );
        })->all();

        $exportUrl = null;
        if (method_exists(static::class, 'tableExportEnabled') && static::tableExportEnabled() && method_exists(static::class, 'resolveExportUrl')) {
            $exportUrl = static::resolveExportUrl();
        }

        $dataCollection = $data instanceof \Illuminate\Support\Collection ? $data : collect($data);
        $footer = static::tableFooter($dataCollection);

        return new DataTableResponse(
            data: $dataCollection->all(),
            columns: static::tableColumns(),
            quickViews: $quickViews,
            meta: new DataTableMeta(
                currentPage: $paginator->currentPage(),
                lastPage: $paginator->lastPage(),
                perPage: $paginator->perPage(),
                total: $paginator->total(),
                sorts: $sorts,
                filters: $request->get($filterParam, []),
                filterParam: $filterParam,
            ),
            exportUrl: $exportUrl,
            footer: ! empty($footer) ? $footer : null,
        );
    }

    protected static function quickViewMatchesRequest(QuickView $qv, Request $request, string $filterParam = 'filter'): bool
    {
        if (empty($qv->params)) {
            return ! $request->has($filterParam) && ! $request->has('sort');
        }

        $qvFilterKeys = [];
        $filterPattern = '/^' . preg_quote($filterParam, '/') . '\[(.+)]$/';

        foreach ($qv->params as $key => $value) {
            $inputKey = preg_replace('/\[([^\]]+)\]/', '.$1', $key);

            if ((string) $request->input($inputKey) !== (string) $value) {
                return false;
            }

            if (preg_match($filterPattern, $key, $m)) {
                $qvFilterKeys[] = $m[1];
            }
        }

        $requestFilterKeys = array_keys($request->get($filterParam, []));

        return count($requestFilterKeys) === count($qvFilterKeys);
    }
}
