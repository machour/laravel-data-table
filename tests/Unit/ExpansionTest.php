<?php

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Machour\DataTable\AbstractDataTable;
use Machour\DataTable\Columns\Column;
use Machour\DataTable\Concerns\HasExpansion;
use Machour\DataTable\DataTableResponse;
use Machour\DataTable\Http\Controllers\DataTableExpansionController;

class ExpansionTestModel extends Model
{
    protected $table = 'expansion_test_models';
    protected $guarded = [];
    public $timestamps = false;
}

class EagerExpansionTable extends AbstractDataTable
{
    use HasExpansion;

    public function __construct(public int $id, public string $slug, public string $name) {}
    public static function tableColumns(): array { return [new Column(id: 'id', label: 'ID', sortable: true), new Column(id: 'name', label: 'Name')]; }
    public static function tableBaseQuery(): \Illuminate\Database\Eloquent\Builder { return ExpansionTestModel::query(); }
    public static function tableExpansionMode(): string { return 'eager'; }
    public static function tableExpansionKey(): string { return 'slug'; }
    public static function tableExpandedData(Model $model): mixed { return ['detail' => strtoupper($model->name)]; }
}

class LazyExpansionTable extends EagerExpansionTable
{
    public static function tableExpansionMode(): string { return 'lazy'; }
    public static function tableExpansionName(): string { return 'expansion-tests'; }
    public static function tableExpansionCache(): bool { return false; }
}

class DisabledExpansionTable extends LazyExpansionTable
{
    public static function tableExpansionEnabled(): bool { return false; }
}

beforeEach(function () {
    Schema::dropIfExists('expansion_test_models');
    Schema::create('expansion_test_models', function (Blueprint $table) {
        $table->id();
        $table->string('slug')->unique();
        $table->string('name');
    });

    ExpansionTestModel::query()->insert([
        ['id' => 1, 'slug' => 'first', 'name' => 'One'],
        ['id' => 2, 'slug' => 'second', 'name' => 'Two'],
    ]);

    Route::get('/data-table/{table}/expansion/{row}', DataTableExpansionController::class)
        ->name('data-table.expansion');
});

test('legacy tables omit expansion configuration', function () {
    $response = new DataTableResponse([], [], [], new \Machour\DataTable\DataTableMeta(1, 1, 25, 0));

    expect($response->expansion)->toBeNull();
});

test('eager expansion includes current page payloads keyed by the configured key', function () {
    $response = EagerExpansionTable::makeTable(Request::create('/test', 'GET', ['per_page' => 1, 'sort' => 'id']));

    expect($response->data)->toHaveCount(1)
        ->and($response->expansion?->mode)->toBe('eager')
        ->and($response->expansion?->key)->toBe('slug')
        ->and($response->expansion?->data)->toBe(['first' => ['detail' => 'ONE']]);
});

test('lazy expansion emits endpoint metadata without eager payloads', function () {
    $response = LazyExpansionTable::makeTable(Request::create('/test'));

    expect($response->expansion?->mode)->toBe('lazy')
        ->and($response->expansion?->cache)->toBeFalse()
        ->and($response->expansion?->data)->toBeNull()
        ->and($response->expansion?->url)->toContain('/data-table/expansion-tests/expansion/{row}');
});

test('registered lazy endpoint resolves through the base query and returns expanded data', function () {
    DataTableExpansionController::register('expansion-tests', LazyExpansionTable::class);

    $this->getJson('/data-table/expansion-tests/expansion/second')
        ->assertOk()
        ->assertExactJson(['data' => ['detail' => 'TWO']]);
});

test('expansion endpoint rejects unknown tables and inaccessible rows', function () {
    DataTableExpansionController::register('expansion-tests', LazyExpansionTable::class);

    $this->getJson('/data-table/unknown/expansion/first')->assertNotFound();
    $this->getJson('/data-table/expansion-tests/expansion/missing')->assertNotFound();
});

test('expansion endpoint rejects disabled and eager tables', function () {
    DataTableExpansionController::register('disabled-expansion-tests', DisabledExpansionTable::class);
    DataTableExpansionController::register('eager-expansion-tests', EagerExpansionTable::class);

    $this->getJson('/data-table/disabled-expansion-tests/expansion/first')->assertForbidden();
    $this->getJson('/data-table/eager-expansion-tests/expansion/first')->assertForbidden();
});
