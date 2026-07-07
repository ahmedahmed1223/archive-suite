<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class InboxController extends Controller
{
    private const STATUSES = ['new', 'triage', 'ready', 'done'];

    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);

        $items = DB::table('inbox_items')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatItem($row))
            ->values();

        return response()->json(['ok' => true, 'items' => $items]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:300'],
            'source' => ['nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', 'string', 'in:'.implode(',', self::STATUSES)],
        ]);

        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('inbox_items')->insert([
            'id' => $id,
            'user_id' => $userId,
            'title' => trim((string) $validated['title']),
            'source' => $validated['source'] ?? null,
            'note' => $validated['note'] ?? null,
            'status' => $validated['status'] ?? 'new',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'ok' => true,
            'item' => $this->formatItem(DB::table('inbox_items')->where('id', $id)->first()),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:300'],
            'source' => ['sometimes', 'nullable', 'string', 'max:500'],
            'note' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'status' => ['sometimes', 'string', 'in:'.implode(',', self::STATUSES)],
        ]);

        $userId = $this->userId($request);
        $exists = DB::table('inbox_items')->where('id', $id)->where('user_id', $userId)->exists();

        if (! $exists) {
            return response()->json(['ok' => false, 'error' => 'Inbox item not found.', 'code' => 'not_found'], 404);
        }

        $changes = array_intersect_key($validated, array_flip(['title', 'source', 'note', 'status']));
        if ($changes !== []) {
            $changes['updated_at'] = now();
            DB::table('inbox_items')->where('id', $id)->where('user_id', $userId)->update($changes);
        }

        return response()->json([
            'ok' => true,
            'item' => $this->formatItem(DB::table('inbox_items')->where('id', $id)->first()),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);

        $deleted = DB::table('inbox_items')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        if ($deleted < 1) {
            return response()->json(['ok' => false, 'error' => 'Inbox item not found.', 'code' => 'not_found'], 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    private function userId(Request $request): string
    {
        $user = $request->attributes->get('archive_user');

        return (string) $user?->getKey();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatItem(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'title' => $row->title,
            'source' => $row->source,
            'note' => $row->note,
            'status' => $row->status,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
