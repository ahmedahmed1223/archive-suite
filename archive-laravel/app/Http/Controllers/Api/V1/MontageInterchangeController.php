<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MontageProject;
use App\Services\Media\Cmx3600Codec;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class MontageInterchangeController extends Controller
{
    public function previewCmx(Request $request, string $id, Cmx3600Codec $codec): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $project = MontageProject::query()->find($id);
        $actor = $this->archiveUser($request);
        if (! $project || $actor === null || Gate::forUser($actor)->denies('update', $project)) {
            return response()->json(ApiError::envelope('Montage project not found.', 404), 404);
        }
        $data = $request->validate(['edl' => ['required', 'string', 'max:1048576']]);
        return response()->json(['ok' => true, 'format' => 'cmx3600', 'preview' => $codec->preview($data['edl'])]);
    }
}
