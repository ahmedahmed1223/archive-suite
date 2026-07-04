<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class RecordCommentsController extends Controller
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

        $comments = DB::table('record_comments')
            ->where('item_id', $recordId)
            ->whereNull('deleted_at')
            ->orderBy('created_at')
            ->get()
            ->map(fn (stdClass $comment): array => $this->formatComment($comment))
            ->values();

        return response()->json(['ok' => true, 'comments' => $comments]);
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

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:8000'],
        ]);

        $user = $request->attributes->get('archive_user');
        $now = now();
        $id = (string) Str::uuid();

        DB::table('record_comments')->insert([
            'id' => $id,
            'item_id' => $recordId,
            'body' => trim((string) $validated['body']),
            'author_id' => $user?->getKey(),
            'author_name' => $user?->name ?? $user?->email ?? 'مجهول',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $comment = DB::table('record_comments')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'comment' => $this->formatComment($comment),
        ], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $comment = DB::table('record_comments')->where('id', $id)->whereNull('deleted_at')->first();

        if (! $comment instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Comment not found.',
                'code' => 'not_found',
            ], 404);
        }

        DB::table('record_comments')->where('id', $id)->update(['deleted_at' => now(), 'updated_at' => now()]);

        return response()->json([
            'ok' => true,
            'deleted' => true,
        ]);
    }

    private function recordExists(string $id): bool
    {
        return DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->where(function ($query) use ($id): void {
                $query->where('uid', $id)
                    ->orWhere('data->>\'id\'', $id);
            })
            ->exists();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatComment(?stdClass $comment): array
    {
        if (! $comment) {
            return [];
        }

        return [
            'id' => $comment->id,
            'itemId' => $comment->item_id,
            'body' => $comment->body,
            'authorId' => $comment->author_id,
            'authorName' => $comment->author_name,
            'createdAt' => $comment->created_at,
            'updatedAt' => $comment->updated_at,
        ];
    }
}
