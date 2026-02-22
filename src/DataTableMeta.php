<?php

namespace Machour\DataTable;

use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
class DataTableMeta extends Data
{
    public function __construct(
        public int $currentPage,
        public int $lastPage,
        public int $perPage,
        public int $total,
        public array $sorts = [],
        public array $filters = [],
        public string $filterParam = 'filter',
    ) {}
}
