<?php

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Machour\DataTable\Columns\Column;
use Machour\DataTable\Concerns\HasExport;
use Machour\DataTable\DataTableExport;
use PhpOffice\PhpSpreadsheet\IOFactory;

class DataTableExportRow extends Model
{
    protected $table = 'data_table_export_rows';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'active' => 'boolean',
    ];
}

class DataTableExportTable
{
    use HasExport;

    public static function tableExportEnabled(): bool
    {
        return true;
    }

    public static function tableExportName(): string
    {
        return 'test-rows';
    }

    public static function tableExportFilename(): string|Closure
    {
        return 'test-export';
    }

    public static function tableColumns(): array
    {
        return [
            new Column(id: 'name', label: 'Name'),
            new Column(id: 'active', label: 'Active', type: 'boolean'),
        ];
    }

    public static function tableBaseQuery(): Builder
    {
        return DataTableExportRow::query();
    }

    public static function tableAllowedFilters(): array
    {
        return [];
    }

    public static function tableAllowedSorts(): array
    {
        return [];
    }

    public static function tableDefaultSort(): string
    {
        return 'id';
    }

    public static function filterParamName(): string
    {
        return 'filter';
    }
}

beforeEach(function () {
    config()->set('database.default', 'testing');
    config()->set('database.connections.testing', [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
    ]);

    Schema::create('data_table_export_rows', function (Blueprint $table) {
        $table->id();
        $table->string('name');
        $table->boolean('active');
    });

    DataTableExportRow::query()->insert([
        ['id' => 1, 'name' => 'Alpha', 'active' => true],
        ['id' => 2, 'name' => 'Beta', 'active' => false],
    ]);
});

afterEach(function () {
    Schema::dropIfExists('data_table_export_rows');
});

function makeDataTableExport(): DataTableExport
{
    return new DataTableExport(
        DataTableExportRow::query()->orderBy('id'),
        [
            ['id' => 'name', 'label' => 'Name'],
            ['id' => 'active', 'label' => 'Active'],
        ],
    );
}

test('it stores an xlsx export directly with phpspreadsheet', function () {
    $path = tempnam(sys_get_temp_dir(), 'data-table-xlsx-');

    try {
        makeDataTableExport()->store($path, 'xlsx');

        $worksheet = IOFactory::load($path)->getActiveSheet();

        expect($worksheet->rangeToArray('A1:B3', null, true, true, false))->toBe([
            ['Name', 'Active'],
            ['Alpha', 'Oui'],
            ['Beta', 'Non'],
        ]);
    } finally {
        @unlink($path);
    }
});

test('it stores a csv export directly with phpspreadsheet', function () {
    $path = tempnam(sys_get_temp_dir(), 'data-table-csv-');

    try {
        makeDataTableExport()->store($path, 'csv');

        $rows = array_map('str_getcsv', file($path, FILE_IGNORE_NEW_LINES));

        expect($rows)->toBe([
            ['Name', 'Active'],
            ['Alpha', 'Oui'],
            ['Beta', 'Non'],
        ]);
    } finally {
        @unlink($path);
    }
});

test('it rejects unsupported export formats', function () {
    $path = tempnam(sys_get_temp_dir(), 'data-table-invalid-');

    try {
        makeDataTableExport()->store($path, 'ods');
    } finally {
        @unlink($path);
    }
})->throws(InvalidArgumentException::class, 'Unsupported export format: ods');

test('it downloads an export with the expected filename and content type', function () {
    $response = DataTableExportTable::downloadExport('csv', request());
    $path = $response->getFile()->getPathname();

    try {
        expect($response->headers->get('content-type'))->toBe('text/csv')
            ->and($response->headers->get('content-disposition'))->toContain('test-export.csv')
            ->and(array_map('str_getcsv', file($path, FILE_IGNORE_NEW_LINES))[1])->toBe(['Alpha', 'Oui']);
    } finally {
        @unlink($path);
    }
});
