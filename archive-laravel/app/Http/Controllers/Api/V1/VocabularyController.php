<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class VocabularyController extends Controller
{
    private const KINDS = ['type', 'tag', 'custom'];

    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);

        $terms = DB::table('vocabulary_terms')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatTerm($row))
            ->values();

        return response()->json(['ok' => true, 'terms' => $terms]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'term' => ['required', 'string', 'max:200'],
            'kind' => ['nullable', 'string', 'in:'.implode(',', self::KINDS)],
            'aliases' => ['nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('vocabulary_terms')->insert([
            'id' => $id,
            'user_id' => $userId,
            'term' => trim((string) $validated['term']),
            'kind' => $validated['kind'] ?? 'custom',
            'aliases' => $validated['aliases'] ?? null,
            'note' => $validated['note'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'ok' => true,
            'term' => $this->formatTerm(DB::table('vocabulary_terms')->where('id', $id)->first()),
        ], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $userId = $this->userId($request);

        $deleted = DB::table('vocabulary_terms')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        if ($deleted < 1) {
            return response()->json([
                'ok' => false,
                'error' => 'Vocabulary term not found.',
                'code' => 'not_found',
            ], 404);
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
    private function formatTerm(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'term' => $row->term,
            'kind' => $row->kind,
            'aliases' => $row->aliases,
            'note' => $row->note,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
