<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CuratedCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CuratedCollectionsController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['ok' => true, 'collections' => CuratedCollection::query()->latest()->get()->map(fn (CuratedCollection $collection): array => $this->payload($collection))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $data = $request->validate(['title' => ['required', 'string', 'max:500'], 'introduction' => ['nullable', 'string', 'max:5000']]);
        $collection = CuratedCollection::query()->create(['id' => (string) Str::uuid(), 'title' => trim($data['title']), 'introduction' => $data['introduction'] ?? null, 'status' => 'draft', 'created_by' => $request->attributes->get('archive_user')?->getKey()]);

        return response()->json(['ok' => true, 'collection' => $this->payload($collection)], 201);
    }

    public function records(string $id): JsonResponse
    {
        if (! CuratedCollection::query()->whereKey($id)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Curated collection not found.', 'code' => 'not_found'], 404);
        }

        return response()->json(['ok' => true, 'recordIds' => DB::table('curated_collection_records')->where('curated_collection_id', $id)->orderBy('position')->pluck('record_id')]);
    }

    public function addRecord(Request $request, string $id, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        if (! CuratedCollection::query()->whereKey($id)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Curated collection not found.', 'code' => 'not_found'], 404);
        }
        DB::table('curated_collection_records')->updateOrInsert(['curated_collection_id' => $id, 'record_id' => $recordId], ['position' => ((int) DB::table('curated_collection_records')->where('curated_collection_id', $id)->max('position')) + 1, 'added_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function reorderRecords(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        if (! CuratedCollection::query()->whereKey($id)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Curated collection not found.', 'code' => 'not_found'], 404);
        }

        $data = $request->validate(['recordIds' => ['required', 'array'], 'recordIds.*' => ['required', 'string', 'distinct']]);
        $recordIds = $data['recordIds'];
        $existingRecordIds = DB::table('curated_collection_records')->where('curated_collection_id', $id)->pluck('record_id')->all();
        $requested = $recordIds;
        sort($existingRecordIds);
        sort($requested);
        if ($existingRecordIds !== $requested) {
            return response()->json(['ok' => false, 'error' => 'Record order must include every current collection record exactly once.', 'code' => 'invalid_record_order'], 422);
        }

        DB::transaction(function () use ($id, $recordIds): void {
            foreach ($recordIds as $position => $recordId) {
                DB::table('curated_collection_records')->where('curated_collection_id', $id)->where('record_id', $recordId)->update(['position' => $position + 1]);
            }
        });

        return response()->json(['ok' => true, 'recordIds' => $recordIds]);
    }

    public function removeRecord(Request $request, string $id, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $deleted = DB::table('curated_collection_records')->where('curated_collection_id', $id)->where('record_id', $recordId)->delete();
        if ($deleted < 1) {
            return response()->json(['ok' => false, 'error' => 'Curated collection record not found.', 'code' => 'not_found'], 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /** @return array<string, mixed> */
    private function payload(CuratedCollection $collection): array
    {
        return ['id' => $collection->id, 'title' => $collection->title, 'introduction' => $collection->introduction, 'status' => $collection->status, 'createdAt' => $collection->created_at?->toISOString(), 'updatedAt' => $collection->updated_at?->toISOString()];
    }
}
