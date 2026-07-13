<?php

namespace Machour\DataTable;

use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
class DataTableExpansion extends Data
{
    public function __construct(
        public string $mode,
        public string $key,
        public bool $cache,
        public ?string $url = null,
        public ?array $data = null,
    ) {}
}
