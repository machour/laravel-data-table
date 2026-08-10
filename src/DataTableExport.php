<?php

namespace Machour\DataTable;

use Illuminate\Database\Eloquent\Builder;
use InvalidArgumentException;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Csv;
use PhpOffice\PhpSpreadsheet\Writer\IWriter;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class DataTableExport
{
    /**
     * @param  array<int, array{id: string, label: string}>  $columns
     */
    public function __construct(
        protected Builder $builder,
        protected array $columns,
    ) {}

    public function query(): Builder
    {
        return $this->builder;
    }

    public function headings(): array
    {
        return array_map(fn (array $col) => $col['label'], $this->columns);
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Model  $row
     */
    public function map($row): array
    {
        return array_map(function (array $col) use ($row) {
            $value = data_get($row, $col['id']);

            if (is_bool($value)) {
                return $value ? 'Oui' : 'Non';
            }

            return $value;
        }, $this->columns);
    }

    public function store(string $path, string $format): void
    {
        $spreadsheet = new Spreadsheet;

        try {
            $writer = $this->writer($spreadsheet, $format);
            $worksheet = $spreadsheet->getActiveSheet();
            $worksheet->fromArray($this->headings(), null, 'A1', true);

            $rowNumber = 2;
            foreach ($this->builder->lazy() as $row) {
                $worksheet->fromArray($this->map($row), null, "A{$rowNumber}", true);
                $rowNumber++;
            }

            $writer->save($path);
        } finally {
            $spreadsheet->disconnectWorksheets();
        }
    }

    protected function writer(Spreadsheet $spreadsheet, string $format): IWriter
    {
        return match ($format) {
            'csv' => new Csv($spreadsheet),
            'xlsx' => new Xlsx($spreadsheet),
            default => throw new InvalidArgumentException("Unsupported export format: {$format}"),
        };
    }
}
