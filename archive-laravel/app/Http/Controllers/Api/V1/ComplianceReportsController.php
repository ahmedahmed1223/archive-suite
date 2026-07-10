<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Reports\ComplianceReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ComplianceReportsController extends Controller
{
    public function index(Request $request, ComplianceReportService $reports): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json([
            'ok' => true,
            ...$reports->report($this->filters($request)),
        ]);
    }

    public function export(Request $request, ComplianceReportService $reports): Response|JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->streamDownload(
            function () use ($reports, $request): void {
                echo $reports->csv($this->filters($request));
            },
            'archive-compliance-report-'.now()->format('Y-m-d').'.csv',
            ['Content-Type' => 'text/csv; charset=UTF-8'],
        );
    }

    /**
     * @return array{from?: string|null, to?: string|null, event?: string|null, resourceType?: string|null, outcome?: string|null, limit?: int|null}
     */
    private function filters(Request $request): array
    {
        /** @var array{from?: string|null, to?: string|null, event?: string|null, resourceType?: string|null, outcome?: string|null, limit?: int|null} $validated */
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'event' => ['nullable', 'string', 'max:120'],
            'resourceType' => ['nullable', 'string', 'max:120'],
            'outcome' => ['nullable', 'in:success,rejected,failed'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        return $validated;
    }
}
