<?php

namespace Machour\DataTable\Concerns;

use Illuminate\Database\Eloquent\Model;

trait HasExpansion
{
    abstract public static function tableExpandedData(Model $model): mixed;

    public static function tableExpansionEnabled(): bool
    {
        return true;
    }

    public static function tableExpansionName(): string
    {
        return class_basename(static::class);
    }

    public static function tableExpansionMode(): string
    {
        return 'lazy';
    }

    public static function tableExpansionKey(): string
    {
        return 'id';
    }

    public static function tableExpansionCache(): bool
    {
        return true;
    }

    public static function resolveExpansionUrl(): string
    {
        $placeholder = '__data_table_row__';
        $url = route('data-table.expansion', [
            'table' => static::tableExpansionName(),
            'row' => $placeholder,
        ]);

        return str_replace($placeholder, '{row}', $url);
    }
}
