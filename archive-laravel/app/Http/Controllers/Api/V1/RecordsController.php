<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\RecordChanged;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Repositories\StorageRowRepository;
use App\Services\Automation\AutomationRuleRunner;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use JsonException;
use stdClass;
use Illuminate\Support\Str;

class RecordsController extends Controller
{
    public function __construct(private readonly StorageRowRepository $storageRows) {}

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $validated = $request->validate([
            'store' => ['nullable', 'string', 'max:100'], 'title' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'], 'type' => ['nullable', 'string', 'max:100'],
            'subtype' => ['nullable', 'string', 'max:100'], 'tags' => ['nullable', 'array'], 'tags.*' => ['string', 'max:100'],
        ]);
        $store = $validated['store'] ?? 'archive-items';
        $id = (string) Str::uuid();
        $now = now();
        $record = ['id'=>$id,'uid'=>$id,'title'=>trim($validated['title']),'description'=>$validated['description'] ?? '',
            'type'=>$validated['type'] ?? null,'subtype'=>$validated['subtype'] ?? null,'tags'=>$validated['tags'] ?? [],
            'attachmentCount'=>0,'createdAt'=>$now->toIso8601String(),'updatedAt'=>$now->toIso8601String()];
        $this->storageRows->insert($store, $id, ['data'=>json_encode($record, JSON_THROW_ON_ERROR),'created_at'=>$now,'updated_at'=>$now]);
        return response()->json(['ok'=>true,'record'=>$record], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store' => ['required', 'string'],
            'cursor' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 50);
        $cursorUid = isset($validated['cursor']) ? StorageRowPayload::decodeCursor($validated['cursor']) : null;

        $query = $this->storageRows->forStore($validated['store'])
            ->orderBy('uid')
            ->limit($limit + 1);

        if ($cursorUid !== null) {
            $query->where('uid', '>', $cursorUid);
        }

        $rows = $query->get();
        $hasMore = $rows->count() > $limit;
        $pageRows = $rows->take($limit);
        $records = $pageRows->map(fn (stdClass $row): array => StorageRowPayload::format($row))->values();
        $lastRow = $pageRows->last();

        return response()->json([
            'ok' => true,
            'records' => $records,
            'nextCursor' => $hasMore && $lastRow instanceof stdClass ? StorageRowPayload::encodeCursor($lastRow->uid) : null,
        ]);
    }

    /**
     * @throws ValidationException
     * @throws JsonException
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'store' => ['nullable', 'string'],
        ]);

        $store = $request->input('store');

        $row = $this->storageRows->findByUidOrRecordId($id, $store);

        if (! $row instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Record not found.',
                'code' => 'not_found',
            ], 404);
        }

        $record = StorageRowPayload::format($row);
        $record['attachmentCount'] = DB::table('record_attachments')->where(['record_store' => $row->store, 'record_uid' => $row->uid])->count();

        return response()->json([
            'ok' => true,
            'record' => $record,
        ]);
    }

    /**
     * @throws ValidationException
     * @throws JsonException
     */
    public function bulk(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'store' => ['required', 'string'],
            'records' => ['required', 'array', 'max:10000'],
            'records.*' => ['required', 'array'],
            'records.*.uid' => ['sometimes', 'string'],
            'records.*.id' => ['sometimes', 'string'],
            'records.*.syncVersion' => ['nullable', 'integer'],
            'records.*.lastModifiedBy' => ['nullable', 'array'],
            'records.*.fieldSources' => ['sometimes', 'array'],
            'records.*.fieldSources.*' => ['string', 'in:manual,template,csv,bulk'],
        ]);

        $validator->after(function ($validator) use ($request): void {
            foreach ((array) $request->input('records', []) as $index => $record) {
                if (! is_array($record) || (! isset($record['uid']) && ! isset($record['id']))) {
                    $validator->errors()->add("records.$index.uid", 'Each record must include uid or id.');
                }
            }
        });

        $validated = $validator->validate();
        $records = (array) $request->input('records', []);

        // V1-726: a viewer with an active editor delegation scoped to every
        // uid/id in this batch may proceed instead of always requiring the
        // global editor/admin role.
        $requestedIds = array_map(
            fn (array $record): string => (string) ($record['uid'] ?? $record['id']),
            $records,
        );
        if ($denied = $this->requireEditorOrDelegatedAccess($request, $requestedIds)) {
            return $denied;
        }
        $now = now();
        $count = 0;
        $blocked = [];
        $isAdmin = $request->attributes->get('archive_user')?->role === 'admin';

        foreach ($records as $record) {
            $uid = (string) ($record['uid'] ?? $record['id']);
            // V1-868: fieldSources is metadata about the write, not part of the
            // record itself — stripped before it ever reaches storage_rows.data.
            $fieldSources = (array) ($record['fieldSources'] ?? []);
            unset($record['fieldSources']);
            $normalized = ['uid' => $uid] + $record;

            // V1-758B: existence check happens BEFORE the write so we know
            // whether this was a create or an update once RecordChanged
            // fires below.
            $existingRow = $this->storageRows->find($validated['store'], $uid);
            $existed = $existingRow !== null;

            // V1-866: a frozen record rejects writes at the API level, not
            // just the UI. Documented override: admins may still write.
            if ($existed && ! $isAdmin && DB::table('record_freezes')->where('record_id', $uid)->exists()) {
                $blocked[] = $uid;
                continue;
            }

            // V1-834: snapshot the pre-write state so a later diff/restore has
            // something to compare against. Best-effort and non-fatal — a
            // snapshot failure must never block the actual save.
            if ($existed) {
                try {
                    DB::table('record_metadata_snapshots')->insert([
                        'id' => (string) Str::uuid(),
                        'store' => $validated['store'],
                        'record_id' => $uid,
                        'snapshot' => is_string($existingRow->data ?? null) ? $existingRow->data : json_encode($existingRow->data ?? [], JSON_THROW_ON_ERROR),
                        'changed_by' => $request->attributes->get('archive_user')?->getKey(),
                        'created_at' => $now,
                    ]);
                } catch (\Throwable) {
                    // Snapshotting is a diagnostic aid, not part of the write contract.
                }
            }

            $this->storageRows->upsert($validated['store'], $uid, [
                    'data' => json_encode($normalized, JSON_THROW_ON_ERROR),
                    'sync_version' => $record['syncVersion'] ?? null,
                    'last_modified_by' => json_encode($record['lastModifiedBy'] ?? null, JSON_THROW_ON_ERROR),
                    'updated_at' => $now,
                    'created_at' => $now,
            ]);

            // V1-758B: automation only reacts to the archive store, and only
            // from this HTTP write path - see AutomationRuleRunner's
            // docblock for why the service itself never dispatches this.
            if ($validated['store'] === AutomationRuleRunner::ARCHIVE_STORE) {
                RecordChanged::dispatch($validated['store'], $uid, $normalized, ! $existed);
            }

            // V1-868: opt-in per-field source tracking — a caller that never
            // sends fieldSources leaves this table untouched entirely.
            foreach ($fieldSources as $field => $source) {
                try {
                    DB::table('record_field_sources')->updateOrInsert(
                        ['record_id' => $uid, 'field' => (string) $field],
                        ['source' => $source, 'updated_at' => $now]
                    );
                } catch (\Throwable) {
                    // Source tracking is a diagnostic aid, not part of the write contract.
                }
            }

            $count++;
        }

        return response()->json(['ok' => true, 'count' => $count, 'blocked' => $blocked]);
    }

    /**
     * @throws ValidationException
     */
    public function bulkDelete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store' => ['required', 'string'],
            'ids' => ['required', 'array', 'min:1', 'max:10000'],
            'ids.*' => ['required', 'string'],
        ]);

        // V1-726: same delegated-access allowance as bulk() above.
        if ($denied = $this->requireEditorOrDelegatedAccess($request, $validated['ids'])) {
            return $denied;
        }

        $results = [];
        $count = 0;
        $actor = $request->attributes->get('archive_user');

        // ponytail: one delete per id keeps per-item results simple; batch it if 10k-id payloads show up for real.
        foreach (array_values(array_unique($validated['ids'])) as $id) {
            // V1-731: delete is now a move into `trashed_records`, not a
            // destroy. The row still leaves storage_rows, so every reader of
            // that table behaves exactly as before; the payload survives for
            // the retention window and TrashController can put it back.
            $rows = DB::table('storage_rows')
                ->where('store', $validated['store'])
                ->where(function ($query) use ($id): void {
                    $query->where('uid', $id)
                        ->orWhere('data->>\'id\'', $id);
                })
                ->get();

            $deleted = 0;

            foreach ($rows as $row) {
                DB::transaction(function () use ($row, $actor): void {
                    TrashController::trashRow($row, $actor instanceof User ? $actor : null);

                    $this->storageRows->delete($row->store, $row->uid);
                });

                $deleted++;
            }

            $results[] = ['uid' => $id, 'deleted' => $deleted > 0];

            if ($deleted > 0) {
                $count++;
            }
        }

        return response()->json(['ok' => true, 'count' => $count, 'results' => $results]);
    }

}
