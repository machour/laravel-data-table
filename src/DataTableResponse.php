<?php

namespace Machour\DataTable;

use Machour\DataTable\Columns\Column;
use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
class DataTableResponse extends Data
{
    public function __construct(
        public array $data,
        public array $columns,
        public array $quickViews,
        public DataTableMeta $meta,
        public ?string $exportUrl = null,
        public ?array $footer = null,
        public ?DataTableExpansion $expansion = null,
    ) {}
}
