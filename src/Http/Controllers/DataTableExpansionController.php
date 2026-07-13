<?php

namespace Machour\DataTable\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Machour\DataTable\AbstractDataTable;

class DataTableExpansionController
{
    /** @var array<string, class-string<AbstractDataTable>> */
    protected static array $registry = [];

    public static function register(string $tableName, string $dataTableClass): void
    {
        static::$registry[$tableName] = $dataTableClass;
    }

    public function __invoke(string $table, string $row): JsonResponse
    {
        $class = static::$registry[$table] ?? null;

        abort_unless((bool) $class, 404, "Unknown table: {$table}");
        abort_unless(method_exists($class, 'tableExpansionEnabled') && $class::tableExpansionEnabled(), 403, 'Expansion is not enabled for this table.');
        abort_unless($class::tableExpansionMode() === 'lazy', 403, 'Lazy expansion is not enabled for this table.');

        $key = $class::tableExpansionKey();
        abort_unless(preg_match('/^[A-Za-z_][A-Za-z0-9_.]*$/', $key) === 1, 422, 'Invalid expansion key.');
        abort_unless($row !== '' && strlen($row) <= 255, 422, 'Invalid row key.');

        $model = $class::tableBaseQuery()->where($key, $row)->first();
        abort_unless((bool) $model, 404, 'Expandable row not found.');

        return response()->json(['data' => $class::tableExpandedData($model)]);
    }
}
