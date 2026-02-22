---
name: laravel-data-table-development
description: >-
  Build and work with machour/laravel-data-table features. Activates when creating React pages
  containing data-tables; or when user mentions data table, grid view, crud index, filters,
  quick views, column ordering, exports, or bulk actions.
---

# Laravel DataTable — Consumer Guide

This skill covers the `machour/laravel-data-table` Composer package.

## When to use this skill

- Creating new DataTable pages (CRUD index views)
- Adding columns, filters, sorts, quick views, or exports to a DataTable
- Customizing DataTable frontend rendering (cells, headers, footers, row/bulk actions)
- Working with the filter bar or operator-based URL filtering
- Debugging DataTable behavior (column ordering, pinning, visibility)

## Architecture Overview

**Backend** — one PHP class per model (extends `Machour\DataTable\AbstractDataTable`). Defines DTO properties, columns, filters, sorts, quick views, and optionally exports.

**Frontend** — installed via `npx shadcn@latest add ./vendor/machour/laravel-data-table/react/public/r/data-table.json`. This copies the `<DataTable>` and `<Filters>` React components **into your project** — you own the code. Required shadcn UI components (button, table, checkbox, etc.) are installed automatically as `registryDependencies`.

```
Your app
├── app/DataTables/ProductDataTable.php       ← your DataTable class
├── routes/web.php                            ← Inertia route passing makeTable()
├── resources/js/pages/products/index.tsx     ← React page using <DataTable>
└── resources/js/components/data-table/       ← copied by shadcn add (you own this)

Library provides (Composer)
├── Machour\DataTable\AbstractDataTable       ← base class
├── Machour\DataTable\Columns\Column          ← column DTO
├── Machour\DataTable\QuickView               ← quick view DTO
├── Machour\DataTable\Filters\OperatorFilter  ← Spatie filter
├── Machour\DataTable\Concerns\HasExport      ← export trait
└── react/public/r/data-table.json            ← shadcn registry block
```

## Scaffolding with Artisan

```bash
# Basic scaffold — generates PHP class + React page stub
php artisan make:data-table Product

# With export support
php artisan make:data-table Product --export

# Also append a route to routes/web.php
php artisan make:data-table Product --route

# Custom route file and page path
php artisan make:data-table Product --route --route-file=routes/admin.php --page-path=resources/js/pages/admin
```

**Generated files:**
- `app/DataTables/ProductDataTable.php` — DataTable class with DTO, columns, quick views
- `resources/js/pages/product-table.tsx` — React page stub (path customizable via `--page-path`)

After scaffolding, fill in the DTO properties, columns, and run `php artisan typescript:transform`.

## Creating a DataTable Class Manually

```php
<?php

namespace App\DataTables;

use Machour\DataTable\AbstractDataTable;
use Machour\DataTable\Columns\Column;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
class ProductDataTable extends AbstractDataTable
{
    public function __construct(
        public int $id,
        public ?string $name,
        public ?int $price,
        public ?string $created_at,
    ) {}

    public static function fromModel(Product $model): self
    {
        return new self(
            id: $model->id,
            name: $model->name,
            price: $model->price,
            created_at: $model->created_at?->format('Y-m-d H:i'),
        );
    }

    public static function tableColumns(): array
    {
        return [
            new Column(id: 'id', label: 'ID', type: 'number', sortable: true),
            new Column(id: 'name', label: 'Name', type: 'text', sortable: true, filterable: true),
            new Column(id: 'price', label: 'Price', type: 'number', sortable: true, filterable: true),
            new Column(id: 'created_at', label: 'Created', type: 'date', sortable: true, filterable: true),
        ];
    }

    public static function tableBaseQuery(): Builder
    {
        return Product::query();
    }

    public static function tableDefaultSort(): string
    {
        return '-created_at';
    }
}
```

After creating or modifying a DataTable class, run:
```bash
php artisan typescript:transform
```

## Column Definition

```php
new Column(
    id: 'price',           // Must match DTO public property name exactly
    label: 'Price',        // Display label
    type: 'number',        // text | number | date | option | multiOption | boolean
    sortable: true,        // Allow sorting
    filterable: true,      // Show in filter bar
    visible: true,         // Default visibility (user can toggle)
    options: [...],        // For type=option: [['label' => 'Active', 'value' => '1'], ...]
    min: 0,                // For number range filter (optional)
    max: 100000,           // For number range filter (optional)
    icon: 'check',         // Lucide icon name (optional)
    searchThreshold: 5,    // Show search in option filter if >= N options
    group: 'Details',      // Group columns under a header in the visibility dropdown (optional)
);
```

## Filters with OperatorFilter

```php
use Machour\DataTable\Filters\OperatorFilter;
use Spatie\QueryBuilder\AllowedFilter;

public static function tableAllowedFilters(): array
{
    return [
        AllowedFilter::custom('price', new OperatorFilter('number')),
        AllowedFilter::custom('name', new OperatorFilter('text')),
        AllowedFilter::custom('status', new OperatorFilter('option')),
        AllowedFilter::custom('created_at', new OperatorFilter('date')),
        AllowedFilter::custom('enabled', new OperatorFilter('boolean')),
        // Remap filter name to a different DB column:
        AllowedFilter::custom('display_name', new OperatorFilter('text', 'users.name')),
    ];
}
```

**Operator table:**

| Type | Default | Available |
|------|---------|-----------|
| text | contains | contains, eq |
| number | eq | eq, neq, gt, gte, lt, lte, between |
| date | eq | eq, before, after, between |
| option | in | in, not_in |
| boolean | eq | eq |

All types also support `null` and `not_null`.

## Relation Sorts

```php
use Spatie\QueryBuilder\AllowedSort;

public static function tableAllowedSorts(): array
{
    $relationSorts = [
        AllowedSort::callback('brand_name', function (Builder $query, bool $descending) {
            $query->orderBy(
                Brand::select('name')->whereColumn('brands.id', 'products.brand_id')->limit(1),
                $descending ? 'desc' : 'asc',
            );
        }),
    ];

    // Auto-add simple column sorts for any sortable column not already covered above
    $relationSortNames = collect($relationSorts)->map(fn (AllowedSort $s) => $s->getName())->all();
    $columnSorts = collect(static::tableColumns())
        ->filter(fn (Column $col) => $col->sortable && !in_array($col->id, $relationSortNames, true))
        ->map(fn (Column $col) => $col->id)
        ->values()
        ->all();

    return array_merge($relationSorts, $columnSorts);
}
```

## QuickViews

```php
use Machour\DataTable\QuickView;

public static function tableQuickViews(): array
{
    return [
        new QuickView(id: 'all', label: 'All', params: [], icon: 'list'),
        new QuickView(
            id: 'recent',
            label: 'Last 7 days',
            params: ['filter[created_at]' => 'after:' . now()->subDays(7)->toDateString()],
            icon: 'calendar',
            columns: ['id', 'name', 'created_at'],  // array order = display order
        ),
    ];
}
```

- Empty `params: []` means "active when no filter and no sort in URL"
- `columns` array defines both visibility AND display order

## Footer Aggregations

```php
public static function tableFooter(\Illuminate\Support\Collection $items): array
{
    return [
        'price' => number_format($items->sum('price')) . ' DT',
    ];
}
```

Footer receives only the **current page** items, not grand totals. Custom rendering via `renderFooterCell` prop on the frontend.

## Export (HasExport trait)

Requires `maatwebsite/excel` as a peer dependency.

```php
use Machour\DataTable\Concerns\HasExport;

class ProductDataTable extends AbstractDataTable
{
    use HasExport;

    public static function tableExportEnabled(): bool { return true; }
    public static function tableExportName(): string { return 'products'; }
    public static function tableExportFilename(): string|\Closure { return 'products-export'; }
}
```

Route registration:
```php
use Machour\DataTable\Http\Controllers\DataTableExportController;

DataTableExportController::register('products', ProductDataTable::class);
Route::get('/data-table/export/{table}', DataTableExportController::class)->name('data-table.export');
```

## Frontend — React Page

```tsx
import { DataTable } from "laravel-data-table";
import type { DataTableResponse } from "laravel-data-table";

type Row = App.DataTables.ProductDataTable;

interface Props {
    tableData: DataTableResponse<Row>;
}

export default function ProductTablePage({ tableData }: Props) {
    return (
        <DataTable<Row>
            tableData={tableData}
            tableName="products"
        />
    );
}
```

## Frontend Options (Feature Flags)

All default to `true`. Override via `options` prop:

```tsx
<DataTable
    options={{
        quickViews: false,        // hide server QuickViews
        customQuickViews: false,  // disable saved filter presets
        exports: false,           // hide export button
        filters: false,           // hide filter bar
        columnVisibility: false,  // hide column visibility toggles
        columnOrdering: false,    // disable drag-to-reorder columns
    }}
/>
```

## Custom Cell Rendering

```tsx
<DataTable<Row>
    renderCell={(columnId, value, row) => {
        if (columnId === "price") return <span className="font-bold">{value} DT</span>;
        return undefined; // fall back to default
    }}
/>
```

## Row Actions

```tsx
import type { DataTableAction } from "laravel-data-table";

const actions: DataTableAction<Row>[] = [
    { label: "Edit", onClick: (row) => router.visit(`/products/${row.id}/edit`) },
    { label: "Delete", variant: "destructive", onClick: (row) => router.delete(`/products/${row.id}`), visible: (row) => row.canDelete },
];

<DataTable actions={actions} ... />
```

## Bulk Actions

```tsx
import type { DataTableBulkAction } from "laravel-data-table";
import { Trash2 } from "lucide-react";

const bulkActions: DataTableBulkAction<Row>[] = [
    {
        id: "delete",
        label: "Delete selected",
        icon: Trash2,
        variant: "destructive",
        disabled: (rows) => rows.length === 0,
        onClick: (rows) => router.post("/products/bulk-delete", { ids: rows.map(r => r.id) }),
    },
];

<DataTable bulkActions={bulkActions} ... />
```

## Column Group Styling

```tsx
<DataTable
    groupClassName={{
        Details: "bg-emerald-50/60 dark:bg-emerald-950/20",
        Specs: "bg-violet-50/60 dark:bg-violet-950/5",
    }}
/>
```

## Routing

```php
Route::get('/products', function () {
    return Inertia::render('products/index', [
        'tableData' => ProductDataTable::makeTable(),
    ]);
});
```

## Multiple Tables on One Page

Override `filterParamName()` so filter URL params don't collide:

```php
class InvoiceDataTable extends AbstractDataTable
{
    public static function filterParamName(): string { return 'invoice_filter'; }
}
```

Frontend picks it up automatically, or set it via prop: `<DataTable filterParam="invoice_filter" />`.

## URL Format

```
/products?filter[price]=gte:1000&filter[name]=contains:widget&sort=-price,name&page=2&per_page=50
```

## Critical Rules

1. **Column `id` must match DTO property** — The column `id` in `tableColumns()` must exactly match the public property name on your DataTable class
2. **NO `preserveState: true`** — Never use `preserveState: true` for Inertia navigation. Only `preserveScroll: true`
3. **Options are frontend-only** — `DataTableOptions` is a React-side interface, not a backend DTO
4. **Footer is per-page** — `tableFooter()` receives only the current page items
5. **`columns` array = display order** — When a QuickView specifies `columns`, the array order defines both visibility AND display order
6. **`#[TypeScript]`** — Always add this attribute for type generation (requires `spatie/laravel-typescript-transformer`)
7. **Hidden filters** — Filters needed for QuickViews but not shown as columns must still be in `tableAllowedFilters()`

## Testing Your DataTable

Write Pest feature tests that call `makeTable()` with a crafted request and assert on the response:

```php
use App\DataTables\ProductDataTable;
use App\Models\Product;
use Machour\DataTable\DataTableResponse;
use Machour\DataTable\DataTableMeta;

beforeEach(function () {
    $this->product1 = Product::factory()->create(['name' => 'Widget', 'price' => 1000]);
    $this->product2 = Product::factory()->create(['name' => 'Gadget', 'price' => 5000]);
});

test('makeTable returns correct response structure', function () {
    $response = ProductDataTable::makeTable();

    expect($response)
        ->toBeInstanceOf(DataTableResponse::class)
        ->and($response->data)->toBeArray()->not->toBeEmpty()
        ->and($response->columns)->toBeArray()->not->toBeEmpty()
        ->and($response->meta)->toBeInstanceOf(DataTableMeta::class)
        ->and($response->meta->total)->toBe(2);
});

test('filter by name works', function () {
    $request = Request::create('/products', 'GET', ['filter' => ['name' => 'contains:Widget']]);
    app()->instance('request', $request);

    $response = ProductDataTable::makeTable($request);
    $ids = collect($response->data)->pluck('id')->all();

    expect($ids)
        ->toContain($this->product1->id)
        ->not->toContain($this->product2->id);
});

test('filter by price range works', function () {
    $request = Request::create('/products', 'GET', ['filter' => ['price' => 'between:2000,6000']]);
    app()->instance('request', $request);

    $response = ProductDataTable::makeTable($request);
    $ids = collect($response->data)->pluck('id')->all();

    expect($ids)
        ->toContain($this->product2->id)
        ->not->toContain($this->product1->id);
});

test('sort by price asc works', function () {
    $request = Request::create('/products', 'GET', ['sort' => 'price']);
    app()->instance('request', $request);

    $response = ProductDataTable::makeTable($request);
    $prices = collect($response->data)->pluck('price')->all();

    expect($prices[0])->toBeLessThanOrEqual($prices[1]);
});

test('quickViews are returned with active detection', function () {
    $request = Request::create('/products');
    app()->instance('request', $request);

    $response = ProductDataTable::makeTable($request);
    $allView = collect($response->quickViews)->firstWhere('id', 'all');

    expect($allView)->not->toBeNull()
        ->and($allView->active)->toBeTrue();
});
```

### Key testing patterns

- **Response structure** — assert `DataTableResponse` and `DataTableMeta` types, column count, total
- **Filters** — craft a `Request` with `filter[column]=operator:value`, assert correct rows are returned
- **Sorts** — craft a `Request` with `sort=column` or `sort=-column`, assert order
- **QuickViews** — assert active detection matches URL params
- **Exports** — assert `$response->exportUrl` is not null when `HasExport` is used
- **Relation mapping** — assert DTO fields that come from joined relations (e.g., `brand_name`) are correctly populated
