<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use JsonException;
use stdClass;

class RecordsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'store' => ['required', 'string'],
            'cursor' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 50);
        $cursorUid = isset($validated['cursor']) ? $this->decodeCursor($validated['cursor']) : null;

        $query = DB::table('storage_rows')
            ->where('store', $validated['store'])
            ->orderBy('uid')
            ->limit($limit + 1);

        if ($cursorUid !== null) {
            $query->where('uid', '>', $cursorUid);
        }

        $rows = $query->get();
        $hasMore = $rows->count() > $limit;
        $pageRows = $rows->take($limit);
        $records = $pageRows->map(fn (stdClass $row): array => $this->formatRow($row))->values();
        $lastRow = $pageRows->last();

        return response()->json([
            'ok' => true,
            'records' => $records,
            'nextCursor' => $hasMore && $lastRow instanceof stdClass ? $this->encodeCursor($lastRow->uid) : null,
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
        $now = now();
        $count = 0;

        foreach ($records as $record) {
            $uid = (string) ($record['uid'] ?? $record['id']);
            $normalized = ['store' => $validated['store'], 'uid' => $uid] + $record;

            DB::table('storage_rows')->updateOrInsert(
                ['store' => $validated['store'], 'uid' => $uid],
                [
                    'data' => json_encode($normalized, JSON_THROW_ON_ERROR),
                    'sync_version' => $record['syncVersion'] ?? null,
                    'last_modified_by' => json_encode($record['lastModifiedBy'] ?? null, JSON_THROW_ON_ERROR),
                    'updated_at' => $now,
                    'created_at' => $now,
                ],
            );

            $count++;
        }

        return response()->json(['ok' => true, 'count' => $count]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRow(stdClass $row): array
    {
        $data = json_decode((string) $row->data, true);

        return [
            'store' => $row->store,
            'uid' => $row->uid,
            'id' => $data['id'] ?? $row->uid,
            ...($data ?: []),
            'syncVersion' => $row->sync_version,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    private function encodeCursor(string $uid): string
    {
        return rtrim(strtr(base64_encode($uid), '+/', '-_'), '=');
    }

    private function decodeCursor(string $cursor): string
    {
        return (string) base64_decode(strtr($cursor, '-_', '+/'), true);
    }
}
