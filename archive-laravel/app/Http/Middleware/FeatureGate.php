<?php

namespace App\Http\Middleware;

use App\Services\Settings\CapabilitySettingsService;
use App\Support\ApiError;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * V1-001: gates experimental/hidden route groups behind config('archive.features.*').
 * Off routes 404 rather than 403 — an unannounced surface should look like it
 * doesn't exist, not like a permission problem.
 */
class FeatureGate
{
    public function __construct(private readonly CapabilitySettingsService $settings) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $flag): Response|JsonResponse
    {
        $key = match ($flag) {
            'broadcast_metadata' => 'broadcastMetadata',
            default => $flag,
        };

        if (! $this->settings->isEnabled($key)) {
            return response()->json(ApiError::envelope('Not found.', 404), 404);
        }

        return $next($request);
    }
}
