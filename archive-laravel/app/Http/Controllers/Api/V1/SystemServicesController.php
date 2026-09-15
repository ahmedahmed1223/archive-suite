<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\System\ServiceProbeService;
use Illuminate\Http\JsonResponse;

class SystemServicesController extends Controller
{
    public function __invoke(ServiceProbeService $probeService): JsonResponse
    {
        $services = $probeService->probe();

        return response()->json([
            'ok' => true,
            'services' => $services,
        ]);
    }
}
