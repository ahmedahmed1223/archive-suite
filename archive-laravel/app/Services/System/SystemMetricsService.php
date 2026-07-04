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
     * @return array{cpuLoad: list<float>, memory: array{usedBytes: int, totalBytes: int}, disk: array{usedBytes: int, totalBytes: int}, queueDepth: int}
     */
    public function snapshot(): array
    {
        return [
            'cpuLoad' => $this->cpuLoad(),
            'memory' => $this->memory(),
            'disk' => $this->disk(),
            'queueDepth' => $this->queueDepth(),
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
}
