<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Repositories\StorageRowRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

// V1-834: diff a record's current metadata against a prior snapshot
// (captured by RecordsController::bulk on every update) and restore chosen
// field values from it. Only title/description/type/subtype/tags are
// diffable/restorable — files, rights, and share links are never touched.
class RecordSnapshotsController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';
    private const DIFF_FIELDS = ['title', 'description', 'type', 'subtype', 'tags'];

    public function __construct(private readonly StorageRowRepository $storageRows) {}

    public function index(Request $request, string $recordId): JsonResponse
    {
        $store = $this->store($request);
        $snapshots = DB::table('record_metadata_snapshots')
            ->where('store', $store)
            ->where('record_id', $recordId)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (stdClass $snapshot): array => [
                'id' => $snapshot->id,
                'recordId' => $snapshot->record_id,
                'changedBy' => $snapshot->changed_by,
                'createdAt' => $snapshot->created_at,
            ])
            ->values();

        return response()->json(['ok' => true, 'snapshots' => $snapshots]);
    }

    public function diff(Request $request, string $recordId, string $snapshotId): JsonResponse
    {
        $store = $this->store($request);
        $snapshot = $this->findSnapshot($store, $recordId, $snapshotId);
        if (! $snapshot) return $this->notFound('Snapshot not found.');

        $current = $this->storageRows->find($store, $recordId);
        if (! $current) return $this->notFound('Record not found.');

        $before = json_decode($snapshot->snapshot, true) ?? [];
        $after = json_decode($current->data, true) ?? [];

        $fields = collect(self::DIFF_FIELDS)->map(fn (string $field): array => [
            'field' => $field,
            'previous' => $before[$field] ?? null,
            'current' => $after[$field] ?? null,
            'changed' => ($before[$field] ?? null) !== ($after[$field] ?? null),
        ])->values();

        return response()->json(['ok' => true, 'fields' => $fields]);
    }

    public function restore(Request $request, string $recordId, string $snapshotId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;

        $store = $this->store($request);
        $validated = $request->validate([
            'fields' => ['sometimes', 'array'],
            'fields.*' => ['string', 'in:'.implode(',', self::DIFF_FIELDS)],
        ]);

        $snapshot = $this->findSnapshot($store, $recordId, $snapshotId);
        if (! $snapshot) return $this->notFound('Snapshot not found.');

        $current = $this->storageRows->find($store, $recordId);
        if (! $current) return $this->notFound('Record not found.');

        $before = json_decode($snapshot->snapshot, true) ?? [];
        $currentData = json_decode($current->data, true) ?? [];
        $fieldsToRestore = $validated['fields'] ?? self::DIFF_FIELDS;
        $user = $request->attributes->get('archive_user');
        $now = now();

        // V1-834: a restore is itself a write — snapshot the pre-restore state
        // first, same as any other update, so the restore can be undone too.
        try {
            DB::table('record_metadata_snapshots')->insert([
                'id' => (string) Str::uuid(),
                'store' => $store,
                'record_id' => $recordId,
                'snapshot' => $current->data,
                'changed_by' => $user?->getKey(),
                'created_at' => $now,
            ]);
        } catch (\Throwable) {
            // Non-fatal, same as the write-path snapshot.
        }

        foreach ($fieldsToRestore as $field) {
            if (array_key_exists($field, $before)) {
                $currentData[$field] = $before[$field];
            }
        }

        $this->storageRows->upsert($store, $recordId, [
            'data' => json_encode($currentData, JSON_THROW_ON_ERROR),
            'updated_at' => $now,
        ]);

        return response()->json(['ok' => true, 'restoredFields' => array_values($fieldsToRestore)]);
    }

    private function findSnapshot(string $store, string $recordId, string $snapshotId): ?stdClass
    {
        $row = DB::table('record_metadata_snapshots')
            ->where('id', $snapshotId)
            ->where('store', $store)
            ->where('record_id', $recordId)
            ->first();

        return $row instanceof stdClass ? $row : null;
    }

    private function store(Request $request): string
    {
        return $request->string('store')->trim()->toString() ?: self::ARCHIVE_STORE;
    }

    private function notFound(string $message): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => $message, 'code' => 'not_found'], 404);
    }
}
