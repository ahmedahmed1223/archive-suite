<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\System\SystemControlException;
use App\Services\System\SystemControlService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemControlController extends Controller
{
    /**
     * Every attempt (allowed, blocked by the disabled flag, or rejected for
     * an unknown action) flows through the archive.audit middleware, which
     * classifies this route by status code — see AuditArchiveApiRequest.
     */
    public function run(Request $request, string $action, SystemControlService $service): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        try {
            $result = $service->run($action);

            return response()->json(['ok' => true, 'result' => $result]);
        } catch (SystemControlException $e) {
            return response()->json(ApiError::envelope($e->getMessage(), $e->status, $e->apiCode), $e->status);
        }
    }
}
