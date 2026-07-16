<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemMetricSample;
use App\Services\Backup\DrReadinessService;
use App\Services\System\SystemMetricsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemStatusController extends Controller
{
    public function status(Request $request, SystemMetricsService $metrics, DrReadinessService $dr): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json([
            'ok' => true,
            'metrics' => $metrics->snapshot(),
            'dr' => $dr->probe(),
        ]);
    }

    /**
     * V1-756: the storage series behind the reports-page growth forecast.
     * `days` is clamped rather than trusted — an unbounded window would let a
     * single request table-scan the whole history.
     */
    public function metricsHistory(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $days = (int) $request->query('days', 90);
        $days = max(1, min(365, $days ?: 90));

        $samples = SystemMetricSample::query()
            ->where('captured_at', '>=', now()->subDays($days))
            // Oldest first: the client fits a trend over the series, and a
            // reversed series would fit the same slope with the wrong sign.
            ->orderBy('captured_at')
            ->get()
            ->map(fn (SystemMetricSample $sample): array => [
                'at' => $sample->captured_at->toIso8601String(),
                'usedBytes' => (int) $sample->disk_used_bytes,
                'totalBytes' => (int) $sample->disk_total_bytes,
            ])
            ->all();

        return response()->json(['ok' => true, 'samples' => $samples]);
    }

    public function drProbe(Request $request, DrReadinessService $dr): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json([
            'ok' => true,
            'dr' => $dr->probe(),
        ]);
    }
}
