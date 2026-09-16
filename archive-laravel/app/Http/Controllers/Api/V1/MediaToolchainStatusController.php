<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Media\MediaToolchainStatusService;
use Illuminate\Http\JsonResponse;

/**
 * Read-only status of every independent media-operations toolchain
 * component (ffmpeg, ffprobe, whisper, reverb, gpu, connectors) for the
 * "مركز عمليات الوسائط" status panel. Gated the same as the neighbouring
 * read-only system/* routes (system/capabilities): any authenticated
 * archive user may read it, since it exposes no secrets and no admin-only
 * action follows from it.
 */
class MediaToolchainStatusController extends Controller
{
    public function index(MediaToolchainStatusService $status): JsonResponse
    {
        return response()->json([
            'ok' => true,
            ...$status->status(),
        ]);
    }
}
