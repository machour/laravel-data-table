# Laravel DataTable

A reusable, server-side DataTable system for **Laravel + Inertia.js + React** (TanStack Table v8). Define your table in a single PHP class — get sorting, filtering, pagination, exports, quick views, and a full-featured React UI out of the box.

## Features

- **Single-file backend** — One PHP class per model acts as both DTO and table configuration
- **Server-side everything** — Sorting, filtering, pagination handled by Spatie QueryBuilder
- **Operator-based filters** — URL format `filter[price]=gte:1000` with 14 operators (eq, neq, gt, gte, lt, lte, between, in, not_in, contains, before, after, null, not_null)
- **Quick Views** — Server-defined filter presets + user-saved custom views (localStorage)
- **Column ordering** — Drag-to-reorder via GripVertical handles, persisted to localStorage
- **Column pinning** — Automatic sticky columns for checkbox (`_select`) and actions (`_actions`)
- **Column groups** — Group columns under shared headers with custom background colors
- **Column visibility** — Toggle columns on/off, persisted to localStorage
- **Footer aggregations** — Per-page computed values (sum, avg, etc.) with custom rendering
- **XLSX/CSV export** — Via Maatwebsite Excel (optional peer dependency)
- **Bulk actions** — Checkbox selection with configurable action buttons
- **Row actions** — Per-row dropdown menu with visibility and variant support
- **Responsive** — Mobile popover for toolbar, horizontal scroll for wide tables
- **Feature flags** — Disable any feature via frontend `options` prop

## Requirements

### PHP

| Package | Version |
|---------|---------|
| PHP | ^8.2 |
| Laravel | ^11.0 \| ^12.0 |
| spatie/laravel-data | ^4.0 |
| spatie/laravel-query-builder | ^6.0 |

**Optional:**
- `maatwebsite/excel ^3.1` — for XLSX/CSV export
- `spatie/laravel-typescript-transformer ^2.5` — for TypeScript type generation from DTOs

### JavaScript

Your project must be set up with [shadcn/ui](https://ui.shadcn.com) (React + Tailwind CSS).

The `shadcn add` command will automatically install all required shadcn components (button, table, checkbox, etc.) and npm dependencies (`@tanstack/react-table`, `@inertiajs/react`, `date-fns`, `lucide-react`).

## Installation

### 1. Install the Composer package

```bash
composer require machour/laravel-data-table
```

### 2. Install the React components via shadcn

```bash
npx shadcn@latest add ./vendor/machour/laravel-data-table/react/public/r/data-table.json
```

This copies all DataTable components into your project (you own the code!) and installs the required shadcn UI dependencies automatically.

### 3. (Optional) Install Maatwebsite Excel for export support

```bash
composer require maatwebsite/excel
```

## Quick Start

### 1. Scaffold with the Artisan command

The fastest way to get started:

```bash
php artisan make:data-table Product
```

This generates:
- `app/DataTables/ProductDataTable.php` — your DataTable class
- `resources/js/pages/product-table.tsx` — a React page stub

Available options:

```bash
# Include export support (HasExport trait)
php artisan make:data-table Product --export

# Also append a route to routes/web.php
php artisan make:data-table Product --route

# Custom route file
php artisan make:data-table Product --route --route-file=routes/admin.php

# Custom page output path
php artisan make:data-table Product --page-path=resources/js/pages/admin
```

### 2. Or create your DataTable class manually

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
        public string $name,
        public float $price,
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
            new Column(id: 'name', label: 'Nom', type: 'text', sortable: true, filterable: true),
            new Column(id: 'price', label: 'Prix', type: 'number', sortable: true, filterable: true),
            new Column(id: 'created_at', label: 'Créé le', type: 'date', sortable: true, filterable: true),
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

### 2. Add a route

```php
use App\DataTables\ProductDataTable;
use Inertia\Inertia;

Route::get('/products', function () {
    return Inertia::render('products', [
        'tableData' => ProductDataTable::makeTable(),
    ]);
});
```

### 3. Create your React page

```tsx
import { DataTable } from "laravel-data-table";
import type { DataTableResponse } from "laravel-data-table";
import { Head } from "@inertiajs/react";

type Row = App.DataTables.ProductDataTable;

interface Props {
    tableData: DataTableResponse<Row>;
}

export default function ProductsPage({ tableData }: Props) {
    return (
        <>
            <Head title="Products" />
            <DataTable<Row>
                tableData={tableData}
                tableName="products"
            />
        </>
    );
}
```

That's it! You get sorting, filtering, pagination, column visibility, and column ordering out of the box.

## Backend API

### `AbstractDataTable`

Extend this class for each model. It extends `Spatie\LaravelData\Data`, so it's both a DTO and table configuration.

| Method | Required | Description |
|--------|----------|-------------|
| `tableColumns()` | **Yes** | Returns `Column[]` defining the table structure |
| `tableBaseQuery()` | **Yes** | Returns the base Eloquent `Builder` |
| `tableDefaultSort()` | No | Default sort column (prefix with `-` for desc). Default: `'-id'` |
| `tableQuickViews()` | No | Returns `QuickView[]` for filter presets |
| `tableAllowedFilters()` | No | Auto-derived from `filterable: true` columns. Override for `OperatorFilter` or custom filters |
| `tableAllowedSorts()` | No | Auto-derived from `sortable: true` columns. Override for relation sorts |
| `tableFooter(Collection)` | No | Compute per-page footer aggregations |
| `filterParamName()` | No | URL query parameter name for filters. Default: `'filter'`. Override to avoid collisions with multiple tables on one page |
| `makeTable(?Request)` | Inherited | Builds the `DataTableResponse` — call this in your route |

### `Column`

```php
new Column(
    id: 'price',             // Must match DTO property name
    label: 'Prix',           // Display label
    type: 'number',          // text | number | date | option | multiOption | boolean
    sortable: true,          // Allow sorting
    filterable: true,        // Show in filter bar
    visible: true,           // Default visibility (user can toggle)
    options: [...],          // For type=option: [['label' => 'X', 'value' => 'x'], ...]
    min: 0,                  // For number range (optional)
    max: 100000,             // For number range (optional)
    icon: 'check',           // Lucide icon name (optional)
    searchThreshold: 5,      // Show search input in option filter if >= N options
    group: 'Details',        // Group columns under a header (optional)
);
```

### `QuickView`

```php
new QuickView(
    id: 'recent',
    label: 'Recent',
    params: [
        'filter[created_at]' => 'after:' . now()->subDays(7)->toDateString(),
        'sort' => '-created_at',
    ],
    icon: 'calendar',
    columns: ['id', 'name', 'created_at'],  // Optional: visible columns in display order
);
```

- **Empty `params: []`** matches when no filter and no sort in the URL
- **`columns`** defines both visibility AND display order when the view is active

### `OperatorFilter`

Custom Spatie QueryBuilder filter supporting `operator:value` URL format:

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
        AllowedFilter::custom('display_name', new OperatorFilter('text', 'real_column')),
    ];
}
```

| Type | Default Operator | Available Operators |
|------|-----------------|---------------------|
| `text` | `contains` | `contains`, `eq` |
| `number` | `eq` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between` |
| `date` | `eq` | `eq`, `before`, `after`, `between` |
| `option` | `in` | `in`, `not_in` |
| `boolean` | `eq` | `eq` |

All types also support `null` and `not_null`.

### Export (HasExport trait)

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

Register the export route:

```php
use Machour\DataTable\Http\Controllers\DataTableExportController;

// Register table → class mapping
DataTableExportController::register('products', ProductDataTable::class);

// Add the export route
Route::get('/data-table/export/{table}', DataTableExportController::class)->name('data-table.export');
```

Requires `maatwebsite/excel` to be installed.

## Frontend API

### `<DataTable>` Props

```tsx
interface DataTableProps<TData extends object> {
    tableData: DataTableResponse<TData>;  // Server response from makeTable()
    tableName: string;                     // Unique name for localStorage keys
    filterParam?: string;                  // URL param name for filters (default: from server or 'filter')
    actions?: DataTableAction<TData>[];    // Row actions dropdown
    bulkActions?: DataTableBulkAction<TData>[]; // Bulk actions with checkbox selection
    renderCell?: (columnId: string, value: unknown, row: TData) => ReactNode | undefined;
    renderHeader?: Record<string, ReactNode>;
    renderFooterCell?: (columnId: string, value: unknown) => ReactNode | undefined;
    rowClassName?: (row: TData) => string;
    groupClassName?: Record<string, string>;
    options?: Partial<DataTableOptions>;   // Feature flags (all default to true)
}
```

### Options (Feature Flags)

All default to `true`. Pass `options` prop to disable:

```tsx
<DataTable
    tableData={tableData}
    tableName="products"
    options={{
        quickViews: false,
        customQuickViews: false,
        exports: false,
        filters: false,
        columnVisibility: false,
        columnOrdering: false,
    }}
/>
```

### Custom Cell Rendering

```tsx
<DataTable<Row>
    tableData={tableData}
    tableName="products"
    renderCell={(columnId, value, row) => {
        if (columnId === "price") return <span className="font-bold">{value} DT</span>;
        return undefined; // Fall back to default
    }}
/>
```

### Row Actions

```tsx
const actions: DataTableAction<Row>[] = [
    {
        label: "Edit",
        onClick: (row) => router.visit(`/products/${row.id}/edit`),
    },
    {
        label: "Delete",
        variant: "destructive",
        onClick: (row) => router.delete(`/products/${row.id}`),
        visible: (row) => row.canDelete,
    },
];
```

### Bulk Actions

```tsx
import type { DataTableBulkAction } from "laravel-data-table";
import { Trash2 } from "lucide-react";

const bulkActions: DataTableBulkAction<Row>[] = [
    {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        variant: "destructive",
        disabled: (rows) => rows.length === 0,
        onClick: (rows) => router.post("/products/bulk-delete", { ids: rows.map(r => r.id) }),
    },
];
```

### Footer Aggregations

Backend:
```php
public static function tableFooter(\Illuminate\Support\Collection $items): array
{
    return [
        'price' => $items->sum('price'),
    ];
}
```

Frontend (custom rendering):
```tsx
<DataTable<Row>
    tableData={tableData}
    tableName="products"
    renderFooterCell={(columnId, value) => {
        if (columnId === "price") return <span className="text-emerald-600">{value} DT</span>;
        return undefined;
    }}
/>
```

### Column Group Styling

```tsx
<DataTable<Row>
    tableData={tableData}
    tableName="products"
    groupClassName={{
        Details: "bg-emerald-50/60 dark:bg-emerald-950/20",
        Specs: "bg-violet-50/60 dark:bg-violet-950/5",
    }}
/>
```

## Multiple Tables on One Page

Override `filterParamName()` on each DataTable class so their URL parameters don't collide:

```php
class InvoiceDataTable extends AbstractDataTable
{
    public static function filterParamName(): string
    {
        return 'invoice_filter';
    }
}
```

The frontend picks up the param name automatically from the server response. You can also set it explicitly via the `filterParam` prop:

```tsx
<DataTable tableData={productsData} tableName="products" />
<DataTable tableData={invoicesData} tableName="invoices" filterParam="invoice_filter" />
```

## URL Format

All state is URL-driven and bookmarkable:

```
/products?filter[price]=gte:1000&filter[name]=contains:widget&sort=-price,name&page=2&per_page=50
```

- **Filters**: `filter[column]=operator:value1,value2`
- **Sort**: `sort=column` (asc) or `sort=-column` (desc), comma-separated for multi-sort
- **Pagination**: `page=N&per_page=N`

## localStorage Keys

The component persists user preferences under these keys:

| Key | Purpose |
|-----|---------|
| `dt-columns-{tableName}` | Column visibility state |
| `dt-column-order-{tableName}` | Column display order |
| `dt-quickviews-{tableName}` | Custom saved quick views |

## Testing

```bash
cd vendor/machour/laravel-data-table
composer install
./vendor/bin/pest
```

## License

MIT
