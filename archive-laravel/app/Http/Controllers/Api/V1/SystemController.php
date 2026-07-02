<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSecuritySettingsRequest;
use App\Services\Odbc\OdbcConnectionFactory;
use App\Services\Odbc\OdbcConnectionProbe;
use App\Services\Odbc\OdbcReadRepository;
use App\Services\Security\SecuritySettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemController extends Controller
{
    public function odbc(OdbcConnectionProbe $probe): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'odbc' => $probe->probe(),
        ]);
    }

    public function odbcReadTable(
        Request $request,
        string $table,
        OdbcConnectionFactory $factory,
    ): JsonResponse {
        $repository = new OdbcReadRepository(
            $factory->connect(
                config('odbc.dsn', ''),
                config('odbc.username'),
                config('odbc.password'),
            ),
            config('odbc', []),
        );

        // Check allowlist
        if (! in_array($table, $repository->getAllowedCoreTables(), true)) {
            return response()->json([
                'ok' => false,
                'error' => 'Table access denied.',
            ], 403);
        }

        $limit = (int) $request->query('limit', config('odbc.table_limit', 25));
        $rows = $repository->readRows($table, $limit);

        return response()->json([
            'ok' => true,
            'table' => $table,
            'count' => count($rows),
            'rows' => $rows,
        ]);
    }

    public function odbcCreateRow(
        Request $request,
        string $table,
        OdbcConnectionFactory $factory,
    ): JsonResponse {
        $validated = $request->validate([
            'values' => ['required', 'array', 'min:1'],
        ]);

        return $this->odbcWriteResponse(
            $table,
            'insert',
            fn (OdbcReadRepository $repository): array => $repository->insertRow($table, $validated['values']),
            $factory,
            201,
        );
    }

    public function odbcUpdateRow(
        Request $request,
        string $table,
        OdbcConnectionFactory $factory,
    ): JsonResponse {
        $validated = $request->validate([
            'keyColumn' => ['required', 'string'],
            'keyValue' => ['required'],
            'values' => ['required', 'array', 'min:1'],
        ]);

        return $this->odbcWriteResponse(
            $table,
            'update',
            fn (OdbcReadRepository $repository): array => $repository->updateRow(
                $table,
                $validated['keyColumn'],
                $validated['keyValue'],
                $validated['values'],
            ),
            $factory,
        );
    }

    public function odbcDeleteRow(
        Request $request,
        string $table,
        OdbcConnectionFactory $factory,
    ): JsonResponse {
        $validated = $request->validate([
            'keyColumn' => ['required', 'string'],
            'keyValue' => ['required'],
        ]);

        return $this->odbcWriteResponse(
            $table,
            'delete',
            fn (OdbcReadRepository $repository): array => $repository->deleteRow(
                $table,
                $validated['keyColumn'],
                $validated['keyValue'],
            ),
            $factory,
        );
    }

    public function getSecuritySettings(SecuritySettingsService $service): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'settings' => $service->getSettings(),
        ]);
    }

    public function updateSecuritySettings(
        UpdateSecuritySettingsRequest $request,
        SecuritySettingsService $service,
    ): JsonResponse {
        try {
            $validated = $request->validated();

            if (isset($validated['accessTokenTtlMinutes'])) {
                $service->updateAccessTokenTtl($validated['accessTokenTtlMinutes']);
            }

            if (isset($validated['perUserRateLimit'])) {
                $service->updatePerUserRateLimit($validated['perUserRateLimit']);
            }

            if (isset($validated['webhookUrlAllowlist'])) {
                $service->updateWebhookUrlAllowlist($validated['webhookUrlAllowlist']);
            }

            if (isset($validated['legacyPasswordUpgrade'])) {
                $service->updateLegacyPasswordUpgrade($validated['legacyPasswordUpgrade']);
            }

            return response()->json([
                'ok' => true,
                'settings' => $service->getSettings(),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'ok' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * @param  callable(OdbcReadRepository): array{affected: int}  $operation
     */
    private function odbcWriteResponse(
        string $table,
        string $operationName,
        callable $operation,
        OdbcConnectionFactory $factory,
        int $status = 200,
    ): JsonResponse {
        $repository = new OdbcReadRepository(
            $factory->connect(
                config('odbc.dsn', ''),
                config('odbc.username'),
                config('odbc.password'),
            ),
            config('odbc', []),
        );

        if (! in_array($table, $repository->getAllowedCoreTables(), true)) {
            return response()->json([
                'ok' => false,
                'error' => 'Table access denied.',
            ], 403);
        }

        try {
            $result = $operation($repository);

            return response()->json([
                'ok' => true,
                'table' => $table,
                'operation' => $operationName,
                'affected' => $result['affected'],
            ], $status);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'ok' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }
}
