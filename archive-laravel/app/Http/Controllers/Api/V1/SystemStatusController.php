<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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
