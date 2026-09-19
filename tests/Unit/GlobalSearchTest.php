<?php

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Machour\DataTable\AbstractDataTable;
use Machour\DataTable\Columns\Column;

class GlobalSearchTestModel extends Model
{
    protected $table = 'global_search_test_models';

    public $timestamps = false;

    protected $guarded = [];
}

class GlobalSearchTestTable extends AbstractDataTable
{
    public function __construct(
        public int $id,
        public string $first_name,
        public string $last_name,
        public string $status,
    ) {}

    public static function tableColumns(): array
    {
        return [
            new Column(id: 'id', label: 'ID'),
            new Column(id: 'first_name', label: 'First name'),
            new Column(id: 'last_name', label: 'Last name'),
            new Column(id: 'status', label: 'Status'),
        ];
    }

    public static function tableGlobalSearchFields(): array
    {
        return ['first_name', 'last_name'];
    }

    public static function tableBaseQuery(): Builder
    {
        return GlobalSearchTestModel::query();
    }

    public static function tableDefaultSort(): string
    {
        return 'id';
    }
}

class CustomParamGlobalSearchTestTable extends GlobalSearchTestTable
{
    public static function globalSearchParamName(): string
    {
        return 'people_search';
    }
}

beforeEach(function () {
    Schema::dropIfExists('global_search_test_models');
    Schema::create('global_search_test_models', function (Blueprint $table) {
        $table->id();
        $table->string('first_name');
        $table->string('last_name');
        $table->string('status');
    });

    GlobalSearchTestModel::query()->insert([
        ['id' => 1, 'first_name' => 'Ada', 'last_name' => 'Lovelace', 'status' => 'active'],
        ['id' => 2, 'first_name' => 'Grace', 'last_name' => 'Hopper', 'status' => 'inactive'],
        ['id' => 3, 'first_name' => 'Alan', 'last_name' => 'Turing', 'status' => 'active'],
    ]);
});

afterEach(function () {
    Schema::dropIfExists('global_search_test_models');
});

test('global search filters across declared fields only', function () {
    $firstNameMatch = GlobalSearchTestTable::makeTable(
        Request::create('/test', 'GET', ['search' => 'ada']),
    );
    $lastNameMatch = GlobalSearchTestTable::makeTable(
        Request::create('/test', 'GET', ['search' => 'hopper']),
    );
    $excludedFieldMatch = GlobalSearchTestTable::makeTable(
        Request::create('/test', 'GET', ['search' => 'inactive']),
    );

    expect($firstNameMatch->data)->toHaveCount(1)
        ->and($firstNameMatch->data[0]->first_name)->toBe('Ada')
        ->and($firstNameMatch->meta->globalSearch)->toBe('ada')
        ->and($lastNameMatch->data)->toHaveCount(1)
        ->and($lastNameMatch->data[0]->last_name)->toBe('Hopper')
        ->and($excludedFieldMatch->data)->toBe([]);
});

test('global search supports a custom query parameter', function () {
    $response = CustomParamGlobalSearchTestTable::makeTable(
        Request::create('/test', 'GET', [
            'search' => 'Grace',
            'people_search' => 'Ada',
        ]),
    );

    expect($response->data)->toHaveCount(1)
        ->and($response->data[0]->first_name)->toBe('Ada')
        ->and($response->meta->globalSearch)->toBe('Ada')
        ->and($response->meta->globalSearchParam)->toBe('people_search');
});
