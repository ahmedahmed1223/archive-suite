<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\UploadContentMismatchException;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use App\Services\Records\RecordSourceReplacementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class RecordSourceReplacementController extends Controller
{
    public function index(Request $request, string $id): JsonResponse
    {
        return response()->json(['ok' => true, 'versions' => DB::table('record_source_versions')->where(['record_store' => 'archive-items', 'record_uid' => $id])->orderByDesc('created_at')->get()->map(fn ($v) => ['id' => $v->id, 'createdAt' => $v->created_at, 'fileName' => data_get(json_decode($v->record_data, true), 'fileName')])->all()]);
    }

    public function replace(StoreUploadRequest $request, string $id, RecordSourceReplacementService $service): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        } try {
            return response()->json(['ok' => true, 'record' => $service->replace($id, $request->file('file'), $request->attributes->get('archive_user')?->id)]);
        } catch (UploadContentMismatchException $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage(), 'code' => 'unsafe_file_content'], 422);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage(), 'code' => 'not_found'], 404);
        }
    }

    public function restore(Request $request, string $id, string $versionId, RecordSourceReplacementService $service): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        } try {
            return response()->json(['ok' => true, 'record' => $service->restore($id, $versionId)]);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'error' => $e->getMessage(), 'code' => 'not_found'], 404);
        }
    }
}
