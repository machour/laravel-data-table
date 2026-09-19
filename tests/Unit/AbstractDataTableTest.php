<?php

use Machour\DataTable\Columns\Column;
use Machour\DataTable\QuickView;
use Machour\DataTable\Tests\Stubs\StubDataTable;
use Illuminate\Http\Request;

test('tableColumns returns expected columns', function () {
    $columns = StubDataTable::tableColumns();

    expect($columns)->toHaveCount(4);
    expect($columns[0])->toBeInstanceOf(Column::class)->id->toBe('id');
    expect($columns[1])->toBeInstanceOf(Column::class)->id->toBe('name');
    expect($columns[2])->toBeInstanceOf(Column::class)->id->toBe('status');
    expect($columns[3])->toBeInstanceOf(Column::class)->id->toBe('created_at');
});

test('tableAllowedFilters auto-derives from filterable columns', function () {
    $filters = StubDataTable::tableAllowedFilters();

    expect($filters)->toBe(['name', 'status']);
});

test('tableAllowedSorts auto-derives from sortable columns', function () {
    $sorts = StubDataTable::tableAllowedSorts();

    expect($sorts)->toBe(['id', 'name', 'created_at']);
});

test('tableDefaultSort returns -id', function () {
    expect(StubDataTable::tableDefaultSort())->toBe('-id');
});

test('tableQuickViews returns empty by default', function () {
    expect(StubDataTable::tableQuickViews())->toBe([]);
});

test('tableFooter returns empty by default', function () {
    expect(StubDataTable::tableFooter(collect([])))->toBe([]);
});

test('quickView with empty params matches request without filter or sort', function () {
    $qv = new QuickView(id: 'all', label: 'All', params: []);
    $request = Request::create('/test');

    expect(StubDataTable::testQuickViewMatchesRequest($qv, $request))->toBeTrue();
});

test('quickView with empty params does NOT match when filter present', function () {
    $qv = new QuickView(id: 'all', label: 'All', params: []);
    $request = Request::create('/test', 'GET', ['filter' => ['name' => 'contains:foo']]);

    expect(StubDataTable::testQuickViewMatchesRequest($qv, $request))->toBeFalse();
});

test('quickView with empty params does NOT match when global search is present', function () {
    $qv = new QuickView(id: 'all', label: 'All', params: []);
    $request = Request::create('/test', 'GET', ['search' => 'Ada']);

    expect(StubDataTable::testQuickViewMatchesRequest($qv, $request))->toBeFalse();
});

test('quickView with filter params matches when request has same filters', function () {
    $qv = new QuickView(id: 'enabled', label: 'Enabled', params: ['filter[enabled]' => 'eq:1']);
    $request = Request::create('/test', 'GET', ['filter' => ['enabled' => 'eq:1']]);

    expect(StubDataTable::testQuickViewMatchesRequest($qv, $request))->toBeTrue();
});

test('quickView does NOT match when request has extra filters', function () {
    $qv = new QuickView(id: 'enabled', label: 'Enabled', params: ['filter[enabled]' => 'eq:1']);
    $request = Request::create('/test', 'GET', [
        'filter' => ['enabled' => 'eq:1', 'name' => 'contains:foo'],
    ]);

    expect(StubDataTable::testQuickViewMatchesRequest($qv, $request))->toBeFalse();
});

test('quickView does NOT match when filter value differs', function () {
    $qv = new QuickView(id: 'enabled', label: 'Enabled', params: ['filter[enabled]' => 'eq:1']);
    $request = Request::create('/test', 'GET', ['filter' => ['enabled' => 'eq:0']]);

    expect(StubDataTable::testQuickViewMatchesRequest($qv, $request))->toBeFalse();
});

test('quickView with sort matches when request has same sort', function () {
    $qv = new QuickView(id: 'sorted', label: 'Sorted', params: ['sort' => '-price']);
    $request = Request::create('/test', 'GET', ['sort' => '-price']);

    expect(StubDataTable::testQuickViewMatchesRequest($qv, $request))->toBeTrue();
});
