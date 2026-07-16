<?php

declare(strict_types=1);

namespace App\Services\System;

use Illuminate\Support\Facades\DB;

/**
 * Cheap host metrics using only PHP builtins + the existing `jobs` queue
 * table — no new infra/dependency for a "how's the host doing" panel.
 */
class SystemMetricsService
{
    /**
     * @return array{cpuLoad: list<float>, memory: array{usedBytes: int, totalBytes: int}, disk: array{usedBytes: int, totalBytes: int}, queueDepth: int, queues: list<array{name: string, depth: int, failed: int, oldestJobAgeSec: int}>}
     */
    public function snapshot(): array
    {
        return [
            'cpuLoad' => $this->cpuLoad(),
            'memory' => $this->memory(),
            'disk' => $this->disk(),
            'queueDepth' => $this->queueDepth(),
            'queues' => $this->queues(),
        ];
    }

    /**
     * @return list<float>
     */
    private function cpuLoad(): array
    {
        if (function_exists('sys_getloadavg')) {
            $load = sys_getloadavg();

            if (is_array($load)) {
                return array_map(static fn ($v): float => (float) $v, $load);
            }
        }

        // ponytail: no portable CPU load API on this host (e.g. Windows); report unknown rather than fake data.
        return [];
    }

    /**
     * @return array{usedBytes: int, totalBytes: int}
     */
    private function memory(): array
    {
        $meminfoPath = '/proc/meminfo';

        if (! is_readable($meminfoPath)) {
            return ['usedBytes' => 0, 'totalBytes' => 0];
        }

        $lines = (string) file_get_contents($meminfoPath);
        $total = $this->parseMeminfoKb($lines, 'MemTotal') * 1024;
        $available = $this->parseMeminfoKb($lines, 'MemAvailable') * 1024;

        return [
            'usedBytes' => max(0, $total - $available),
            'totalBytes' => $total,
        ];
    }

    private function parseMeminfoKb(string $meminfo, string $key): int
    {
        if (preg_match('/^'.preg_quote($key, '/').':\s+(\d+)\s+kB/m', $meminfo, $matches) === 1) {
            return (int) $matches[1];
        }

        return 0;
    }

    /**
     * @return array{usedBytes: int, totalBytes: int}
     */
    private function disk(): array
    {
        $path = storage_path();
        $free = @disk_free_space($path);
        $total = @disk_total_space($path);

        if ($free === false || $total === false) {
            return ['usedBytes' => 0, 'totalBytes' => 0];
        }

        return [
            'usedBytes' => (int) ($total - $free),
            'totalBytes' => (int) $total,
        ];
    }

    private function queueDepth(): int
    {
        return (int) DB::table('jobs')->count();
    }

    /**
     * V1-760: per-queue breakdown. `queueDepth` above cannot distinguish a
     * stalled ingest queue from a busy media one, and `jobs` already carries a
     * `queue` column, so this is two grouped reads and no new storage.
     *
     * A queue appears if it has pending OR failed work: dropping a queue whose
     * `jobs` rows are gone but whose `failed_jobs` rows are piling up would
     * hide exactly the queue that needs attention.
     *
     * @return list<array{name: string, depth: int, failed: int, oldestJobAgeSec: int}>
     */
    private function queues(): array
    {
        $pending = DB::table('jobs')
            ->selectRaw('queue, COUNT(*) as depth, MIN(created_at) as oldest')
            ->groupBy('queue')
            ->get()
            ->keyBy('queue');

        $failed = DB::table('failed_jobs')
            ->selectRaw('queue, COUNT(*) as failed')
            ->groupBy('queue')
            ->get()
            ->keyBy('queue');

        $now = time();
        $names = $pending->keys()->merge($failed->keys())->unique()->sort()->values();

        return $names->map(function (string $name) use ($pending, $failed, $now): array {
            $row = $pending->get($name);

            return [
                'name' => $name,
                'depth' => (int) ($row->depth ?? 0),
                'failed' => (int) ($failed->get($name)->failed ?? 0),
                // `jobs.created_at` is a unix timestamp, not a datetime. An idle
                // queue reports 0 rather than an age measured from the epoch.
                'oldestJobAgeSec' => $row === null ? 0 : max(0, $now - (int) $row->oldest),
            ];
        })->all();
    }
}
