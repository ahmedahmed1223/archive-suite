<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MediaDerivative;
use App\Services\Media\MediaDerivativeService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Presents the operational media copies for one record as a single,
 * version-pinned inventory. This deliberately does not invent a preservation
 * or mezzanine copy: a representation appears only when the source or a
 * current derivative exists in the system.
 */
final class MediaRepresentationsController extends Controller
{
    public function __construct(private readonly MediaDerivativeService $derivatives) {}

    public function index(Request $request, string $recordId): JsonResponse
    {
        $store = $request->string('store')->trim()->toString() ?: null;

        try {
            ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->derivatives->assertRecordExists($recordId, $store);
            $versionToken = $this->derivatives->resolveCurrentVersionToken($recordStore, $recordUid);
        } catch (RuntimeException $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 404), 404);
        }

        $record = DB::table('storage_rows')->where(['store' => $recordStore, 'uid' => $recordUid])->first();
        $data = is_object($record) ? json_decode((string) $record->data, true) : null;
        $representations = [];

        if (is_array($data) && (is_string($data['filePath'] ?? null) || is_string($data['fileName'] ?? null))) {
            $representations[] = [
                'id' => 'source:'.hash('sha256', $recordStore.'|'.$recordUid.'|'.$versionToken),
                'type' => 'source',
                'status' => $this->sourceExists($data['filePath'] ?? null) ? 'ready' : 'missing',
                'versionToken' => $versionToken,
                'isCurrentVersion' => true,
                'derivativeId' => null,
                'createdAt' => null,
            ];
        }

        $currentDerivatives = MediaDerivative::query()
            ->where('record_store', $recordStore)
            ->where('record_uid', $recordUid)
            ->where('version_token', $versionToken)
            ->orderBy('derivative_type')
            ->orderByDesc('created_at')
            ->get();

        foreach ($currentDerivatives as $derivative) {
            $representations[] = [
                'id' => 'derivative:'.$derivative->id,
                'type' => $derivative->derivative_type,
                'status' => $derivative->status,
                'versionToken' => $derivative->version_token,
                'isCurrentVersion' => true,
                'derivativeId' => $derivative->id,
                'createdAt' => $derivative->created_at?->toISOString(),
            ];
        }

        return response()->json(['ok' => true, 'representations' => $representations]);
    }

    /**
     * A record can carry a filePath/fileName pointing at storage that was
     * since removed out-of-band (disk cleanup, failed migration, manual
     * deletion). Presenting it as 'ready' anyway would let the record and
     * studio claim playback that will actually fail.
     */
    private function sourceExists(mixed $filePath): bool
    {
        if (! is_string($filePath) || $filePath === '') {
            return false;
        }

        try {
            return Storage::disk((string) config('ingest.disk'))->exists($filePath);
        } catch (\Throwable) {
            return false;
        }
    }
}
