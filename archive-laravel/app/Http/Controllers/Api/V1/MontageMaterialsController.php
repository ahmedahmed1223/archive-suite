<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MontageProject;
use App\Services\Media\ReviewSessionService;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use JsonException;
use stdClass;

/** Lists source-version-pinned archive media that the editor can add to a project. */
class MontageMaterialsController extends Controller
{
    public function __construct(private readonly ReviewSessionService $versions) {}

    public function index(Request $request, string $id): JsonResponse
    {
        $project = MontageProject::query()->find($id);
        if (! $project) {
            return response()->json(ApiError::envelope('Montage project not found.', 404), 404);
        }

        $actor = $this->archiveUser($request);
        if ($actor === null || Gate::forUser($actor)->denies('view', $project)) {
            return response()->json(ApiError::envelope('Montage project not found.', 404), 404);
        }

        $materials = DB::table('storage_rows')
            ->where('store', 'archive-items')
            ->orderByDesc('updated_at')
            ->limit(100)
            ->get()
            ->flatMap(function (stdClass $row): array {
                try {
                    $data = json_decode((string) $row->data, true, flags: JSON_THROW_ON_ERROR);
                } catch (JsonException) {
                    return [];
                }

                $duration = $data['durationSeconds'] ?? $data['duration'] ?? null;
                if (! is_numeric($duration) || (float) $duration <= 0) {
                    return [];
                }

                try {
                    $token = $this->versions->resolveVersionToken('archive-items', (string) $row->uid, null);
                } catch (\RuntimeException) {
                    return [];
                }

                return [[
                    'id' => (string) $row->uid,
                    'name' => is_string($data['title'] ?? null) && $data['title'] !== ''
                        ? $data['title']
                        : (is_string($data['fileName'] ?? null) ? $data['fileName'] : (string) $row->uid),
                    'durationSeconds' => (float) $duration,
                    'source' => [
                        'recordId' => (string) $row->uid,
                        'sourceVersionToken' => $token,
                    ],
                ]];
            })
            ->values();

        return response()->json(['ok' => true, 'materials' => $materials]);
    }
}
