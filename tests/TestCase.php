<?php

namespace Machour\DataTable\Tests;

use Machour\DataTable\DataTableServiceProvider;
use Orchestra\Testbench\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function getPackageProviders($app): array
    {
        return [
            \Spatie\LaravelData\LaravelDataServiceProvider::class,
            DataTableServiceProvider::class,
        ];
    }
}
