<?php

namespace Machour\DataTable\Concerns;

use Machour\DataTable\Columns\Column;
use Machour\DataTable\DataTableExport;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

trait HasExport
{
    abstract public static function tableExportEnabled(): bool;

    abstract public static function tableExportName(): string;

    abstract public static function tableExportFilename(): string|\Closure;

    public static function tableExportColumns(): array
    {
        return collect(static::tableColumns())
            ->map(fn (Column $col) => ['id' => $col->id, 'label' => $col->label])
            ->values()
            ->all();
    }

    public static function resolveExportUrl(): string
    {
        return route('data-table.export', ['table' => static::tableExportName()]);
    }

    public static function resolveExportFilename(?Request $request = null): string
    {
        $filename = static::tableExportFilename();

        if ($filename instanceof \Closure) {
            $request = $request ?? request();
            $filters = $request->get(static::filterParamName(), []);

            return $filename($filters);
        }

        return $filename;
    }

    public static function downloadExport(string $format = 'xlsx', ?Request $request = null): BinaryFileResponse
    {
        $request = $request ?? request();
        $query = static::makeExportQuery($request);
        $columns = static::tableExportColumns();

        $requestedColumns = $request->get('columns');
        if ($requestedColumns) {
            $allowedIds = array_flip(array_column($columns, 'id'));
            $requestedIds = array_flip(array_filter(
                explode(',', $requestedColumns),
                fn (string $id) => isset($allowedIds[$id]),
            ));
            $columns = array_values(array_filter(
                $columns,
                fn (array $col) => isset($requestedIds[$col['id']]),
            ));
        }

        $filename = static::resolveExportFilename($request);

        $writerType = match ($format) {
            'csv' => \Maatwebsite\Excel\Excel::CSV,
            default => \Maatwebsite\Excel\Excel::XLSX,
        };

        $extension = $format === 'csv' ? 'csv' : 'xlsx';

        $export = new DataTableExport($query->getEloquentBuilder(), $columns);

        return Excel::download($export, "{$filename}.{$extension}", $writerType);
    }

    public static function makeExportQuery(?Request $request = null): QueryBuilder
    {
        $request = $request ?? request();

        $filterParam = static::filterParamName();
        $queryRequest = $request;
        if ($filterParam !== 'filter') {
            $queryRequest = clone $request;
            $queryRequest->query->set('filter', $request->get($filterParam, []));
        }

        return QueryBuilder::for(static::tableBaseQuery(), $queryRequest)
            ->allowedFilters(static::tableAllowedFilters())
            ->allowedSorts(static::tableAllowedSorts())
            ->defaultSort(static::tableDefaultSort());
    }
}
