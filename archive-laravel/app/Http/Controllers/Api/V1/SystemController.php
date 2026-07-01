<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Odbc\OdbcConnectionFactory;
use App\Services\Odbc\OdbcConnectionProbe;
use App\Services\Odbc\OdbcReadRepository;
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
}
