<?php

declare(strict_types=1);

namespace App\Services\Reports;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ComplianceReportService
{
    /**
     * @param array{from?: string|null, to?: string|null, event?: string|null, resourceType?: string|null, outcome?: string|null, limit?: int|null} $filters
     * @return array{filters: array<string, mixed>, summary: array<string, mixed>, entries: list<array<string, mixed>>}
     */
    public function report(array $filters): array
    {
        $query = $this->filteredQuery($filters);
        $summaryQuery = clone $query;

        return [
            'filters' => $this->publicFilters($filters),
            'summary' => [
                'total' => $summaryQuery->count(),
                'outcomes' => $this->groupCounts(clone $query, 'outcome'),
                'events' => $this->groupCounts(clone $query, 'event'),
                'resourceTypes' => $this->groupCounts(clone $query, 'resource_type'),
            ],
            'entries' => $query
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit((int) ($filters['limit'] ?? 100))
                ->get()
                ->map(fn (object $row): array => $this->entry($row))
                ->all(),
        ];
    }

    /**
     * @param array{from?: string|null, to?: string|null, event?: string|null, resourceType?: string|null, outcome?: string|null, limit?: int|null} $filters
     */
    public function csv(array $filters): string
    {
        $stream = fopen('php://temp', 'r+');
        if ($stream === false) {
            throw new \RuntimeException('Unable to create compliance report export.');
        }

        // UTF-8 BOM keeps Arabic column labels legible in spreadsheet applications.
        fwrite($stream, "\xEF\xBB\xBF");
        fputcsv($stream, ['event', 'resource_type', 'resource_id', 'actor_id', 'outcome', 'status_code', 'action', 'created_at']);

        $this->filteredQuery($filters)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(10000)
            ->each(function (object $row) use ($stream): void {
                $entry = $this->entry($row);
                fputcsv($stream, [
                    $entry['event'],
                    $entry['resourceType'],
                    $entry['resourceId'],
                    $entry['actorId'],
                    $entry['outcome'],
                    $entry['statusCode'],
                    $entry['action'],
                    $entry['createdAt'],
                ]);
            });

        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);

        return $csv === false ? '' : $csv;
    }

    /**
     * @param array{from?: string|null, to?: string|null, event?: string|null, resourceType?: string|null, outcome?: string|null, limit?: int|null} $filters
     */
    private function filteredQuery(array $filters): Builder
    {
        $query = DB::table('audit_logs')->select([
            'id',
            'event',
            'resource_type',
            'resource_id',
            'actor_id',
            'outcome',
            'status_code',
            'action',
            'created_at',
        ]);

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', Carbon::parse($filters['from'])->startOfDay());
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', Carbon::parse($filters['to'])->endOfDay());
        }

        if (! empty($filters['event'])) {
            $query->where('event', $filters['event']);
        }

        if (! empty($filters['resourceType'])) {
            $query->where('resource_type', $filters['resourceType']);
        }

        if (! empty($filters['outcome'])) {
            $query->where('outcome', $filters['outcome']);
        }

        return $query;
    }

    /** @return array<string, int> */
    private function groupCounts(Builder $query, string $column): array
    {
        $counts = $query
            ->select($column, DB::raw('COUNT(*) as total'))
            ->groupBy($column)
            ->orderByDesc('total')
            ->get()
            ->mapWithKeys(fn (object $row): array => [(string) ($row->{$column} ?? 'unknown') => (int) $row->total])
            ->all();

        if ($column === 'outcome') {
            return array_replace(['success' => 0, 'rejected' => 0, 'failed' => 0], $counts);
        }

        return $counts;
    }

    /** @param object $row @return array<string, mixed> */
    private function entry(object $row): array
    {
        return [
            'id' => $row->id,
            'event' => $row->event,
            'resourceType' => $row->resource_type,
            'resourceId' => $row->resource_id,
            'actorId' => $row->actor_id === null ? null : (string) $row->actor_id,
            'outcome' => $row->outcome,
            'statusCode' => (int) $row->status_code,
            'action' => $row->action,
            'createdAt' => $row->created_at ? Carbon::parse($row->created_at)->toIso8601String() : null,
        ];
    }

    /**
     * @param array{from?: string|null, to?: string|null, event?: string|null, resourceType?: string|null, outcome?: string|null, limit?: int|null} $filters
     * @return array<string, mixed>
     */
    private function publicFilters(array $filters): array
    {
        return [
            'from' => $filters['from'] ?? null,
            'to' => $filters['to'] ?? null,
            'event' => $filters['event'] ?? null,
            'resourceType' => $filters['resourceType'] ?? null,
            'outcome' => $filters['outcome'] ?? null,
            'limit' => (int) ($filters['limit'] ?? 100),
        ];
    }
}
