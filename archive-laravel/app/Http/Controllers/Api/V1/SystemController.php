<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Odbc\OdbcConnectionProbe;
use Illuminate\Http\JsonResponse;

class SystemController extends Controller
{
    public function odbc(OdbcConnectionProbe $probe): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'odbc' => $probe->probe(),
        ]);
    }
}
