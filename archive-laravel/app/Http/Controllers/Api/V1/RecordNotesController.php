<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use stdClass;

class RecordNotesController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    public function index(string $recordId): JsonResponse
    {
        if (! $this->recordExists($recordId)) {
            return response()->json([
                'ok' => false,
                'error' => 'Record not found.',
                'code' => 'not_found',
            ], 404);
        }

        $notes = DB::table('record_notes')
            ->where('item_id', $recordId)
            ->orderByRaw('timestamp_seconds is null')
            ->orderBy('timestamp_seconds')
            ->orderBy('created_at')
            ->get()
            ->map(fn (stdClass $note): array => $this->formatNote($note))
            ->values();

        return response()->json(['ok' => true, 'notes' => $notes]);
    }

    public function store(Request $request, string $recordId): JsonResponse
    {
        if (! $this->recordExists($recordId)) {
            return response()->json([
                'ok' => false,
                'error' => 'Record not found.',
                'code' => 'not_found',
            ], 404);
        }

        $validated = $request->validate($this->rules(requireBody: true));
        $user = $request->attributes->get('archive_user');
        $now = now();
        $id = (string) Str::uuid();
        $body = trim((string) $validated['body']);
        if ($body === '') {
            throw ValidationException::withMessages(['body' => 'The note body is required.']);
        }

        DB::table('record_notes')->insert([
            'id' => $id,
            'item_id' => $recordId,
            'body' => $body,
            'timestamp_seconds' => $validated['timestampSeconds'] ?? null,
            'region' => isset($validated['region']) ? json_encode($validated['region'], JSON_THROW_ON_ERROR) : null,
            'author_id' => $user?->getKey(),
            'author_name' => $user?->name ?? $user?->email ?? 'مجهول',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $note = DB::table('record_notes')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'note' => $this->formatNote($note),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $note = DB::table('record_notes')->where('id', $id)->first();

        if (! $note instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Note not found.',
                'code' => 'not_found',
            ], 404);
        }

        $validated = $request->validate($this->rules(requireBody: false));
        $updates = ['updated_at' => now()];

        if (array_key_exists('body', $validated)) {
            $body = trim((string) $validated['body']);
            if ($body === '') {
                throw ValidationException::withMessages(['body' => 'The note body is required.']);
            }
            $updates['body'] = $body;
        }

        if (array_key_exists('timestampSeconds', $validated)) {
            $updates['timestamp_seconds'] = $validated['timestampSeconds'];
        }

        if (array_key_exists('region', $validated)) {
            $updates['region'] = $validated['region'] === null ? null : json_encode($validated['region'], JSON_THROW_ON_ERROR);
        }

        DB::table('record_notes')->where('id', $id)->update($updates);
        $updatedNote = DB::table('record_notes')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'note' => $this->formatNote($updatedNote),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $deleted = DB::table('record_notes')->where('id', $id)->delete();

        if ($deleted < 1) {
            return response()->json([
                'ok' => false,
                'error' => 'Note not found.',
                'code' => 'not_found',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'deleted' => true,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $requireBody): array
    {
        return [
            'body' => [$requireBody ? 'required' : 'sometimes', 'string', 'max:8000'],
            'timestampSeconds' => ['nullable', 'numeric', 'min:0'],
            'region' => ['nullable', 'array'],
            'region.x' => ['required_with:region', 'numeric'],
            'region.y' => ['required_with:region', 'numeric'],
            'region.w' => ['required_with:region', 'numeric', 'gt:0'],
            'region.h' => ['required_with:region', 'numeric', 'gt:0'],
        ];
    }

    private function recordExists(string $id): bool
    {
        return DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->where(function ($query) use ($id): void {
                $query->where('uid', $id)
                    ->orWhereRaw("data->>'id' = ?", [$id]);
            })
            ->exists();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatNote(?stdClass $note): array
    {
        if (! $note) {
            return [];
        }

        $timestamp = $note->timestamp_seconds;
        if (is_string($timestamp)) {
            $timestamp = (float) $timestamp;
        }

        return [
            'id' => $note->id,
            'itemId' => $note->item_id,
            'body' => $note->body,
            'timestampSeconds' => $timestamp,
            'region' => $note->region ? json_decode((string) $note->region, true) : null,
            'authorId' => $note->author_id,
            'authorName' => $note->author_name,
            'createdAt' => $note->created_at,
            'updatedAt' => $note->updated_at,
        ];
    }
}
