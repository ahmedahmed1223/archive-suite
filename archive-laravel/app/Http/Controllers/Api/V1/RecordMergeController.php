<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;
use Throwable;

// V1-839: merges duplicate records into a chosen primary — tags and allowed
// relations/notes/comments are transferred, the duplicate's own files are
// never touched, and the duplicate is soft-deleted via the existing trash
// mechanism (so "خيار استعادة مضبوط" is the trash restore endpoint that
// already exists, not a new one).
class RecordMergeController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    public function preview(Request $request, string $primaryId): JsonResponse
    {
        $validated = $this->validateRequest($request);
        $store = $validated['store'];

        $primary = $this->findRow($store, $primaryId);
        if (! $primary) {
            return $this->notFound('Primary record not found.');
        }

        $duplicates = collect($validated['duplicateIds'])->map(function (string $id) use ($store): array {
            $row = $this->findRow($store, $id);

            return ['id' => $id, 'found' => $row !== null];
        })->values();

        return response()->json([
            'ok' => true,
            'primaryId' => $primaryId,
            'duplicates' => $duplicates,
            'relationCount' => DB::table('record_relations')
                ->whereIn('source_record_id', $validated['duplicateIds'])
                ->orWhereIn('target_record_id', $validated['duplicateIds'])
                ->count(),
            'noteCount' => DB::table('record_notes')->where('record_store', $store)->whereIn('item_id', $validated['duplicateIds'])->count(),
            'commentCount' => DB::table('record_comments')->where('record_store', $store)->whereIn('item_id', $validated['duplicateIds'])->count(),
        ]);
    }

    public function merge(Request $request, string $primaryId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $this->validateRequest($request);
        $store = $validated['store'];
        $user = $request->attributes->get('archive_user');

        $primary = $this->findRow($store, $primaryId);
        if (! $primary) {
            return $this->notFound('Primary record not found.');
        }

        $merged = [];
        foreach ($validated['duplicateIds'] as $duplicateId) {
            if ($duplicateId === $primaryId) {
                continue;
            }
            $duplicate = $this->findRow($store, $duplicateId);
            if (! $duplicate) {
                continue;
            }

            DB::transaction(function () use ($store, $primary, $duplicate, $duplicateId, $primaryId, $user): void {
                $this->transferTags($primary, $duplicate);
                $this->reassignRelations($duplicateId, $primaryId);
                DB::table('record_notes')->where('record_store', $store)->where('item_id', $duplicateId)->update(['item_id' => $primaryId]);
                DB::table('record_comments')->where('record_store', $store)->where('item_id', $duplicateId)->update(['item_id' => $primaryId]);

                TrashController::trashRow($duplicate, $user instanceof User ? $user : null);
                DB::table('storage_rows')->where('store', $store)->where('uid', $duplicate->uid)->delete();
            });

            $merged[] = $duplicateId;
            $primary = $this->findRow($store, $primaryId);
        }

        return response()->json(['ok' => true, 'primaryId' => $primaryId, 'merged' => $merged]);
    }

    private function transferTags(stdClass $primary, stdClass $duplicate): void
    {
        $primaryData = json_decode($primary->data, true) ?? [];
        $duplicateData = json_decode($duplicate->data, true) ?? [];
        $primaryTags = array_values(array_filter((array) ($primaryData['tags'] ?? []), 'is_string'));
        $duplicateTags = array_values(array_filter((array) ($duplicateData['tags'] ?? []), 'is_string'));
        $merged = array_values(array_unique([...$primaryTags, ...$duplicateTags]));

        if ($merged === $primaryTags) {
            return;
        }

        $primaryData['tags'] = $merged;
        DB::table('storage_rows')->where('store', $primary->store)->where('uid', $primary->uid)->update([
            'data' => json_encode($primaryData, JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }

    private function reassignRelations(string $duplicateId, string $primaryId): void
    {
        foreach (['source_record_id', 'target_record_id'] as $column) {
            $other = $column === 'source_record_id' ? 'target_record_id' : 'source_record_id';
            $rows = DB::table('record_relations')->where($column, $duplicateId)->get();
            foreach ($rows as $row) {
                if ($primaryId === $row->$other) {
                    // Would become a self-relation once reassigned — drop it instead.
                    DB::table('record_relations')->where('id', $row->id)->delete();

                    continue;
                }
                try {
                    DB::table('record_relations')->where('id', $row->id)->update([$column => $primaryId, 'updated_at' => now()]);
                } catch (Throwable) {
                    // Unique(source, target, type) collision with an existing relation on the primary — drop the duplicate link.
                    DB::table('record_relations')->where('id', $row->id)->delete();
                }
            }
        }
    }

    /** @return array{store: string, duplicateIds: array<int, string>} */
    private function validateRequest(Request $request): array
    {
        $validated = $request->validate([
            'store' => ['sometimes', 'string', 'max:120'],
            'duplicateIds' => ['required', 'array', 'min:1', 'max:50'],
            'duplicateIds.*' => ['required', 'string'],
        ]);

        return ['store' => $validated['store'] ?? self::ARCHIVE_STORE, 'duplicateIds' => $validated['duplicateIds']];
    }

    private function findRow(string $store, string $id): ?stdClass
    {
        $row = DB::table('storage_rows')->where('store', $store)->where(function ($query) use ($id): void {
            $query->where('uid', $id)->orWhereRaw("data->>'id' = ?", [$id]);
        })->first();

        return $row instanceof stdClass ? $row : null;
    }

    private function notFound(string $message): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => $message, 'code' => 'not_found'], 404);
    }
}
