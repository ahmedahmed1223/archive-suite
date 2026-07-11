<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

class PublicCatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string'],
            'type' => ['nullable', 'string'],
            'tag' => ['nullable', 'string'],
            'cursor' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $limit = (int) ($validated['limit'] ?? 24);
        $cursorUid = isset($validated['cursor']) ? StorageRowPayload::decodeCursor($validated['cursor']) : null;

        $records = [];
        $lastPublishedUid = null;
        $nextCursor = null;

        $query = DB::table('storage_rows')
            ->orderBy('uid')
            ->limit(500);

        if ($cursorUid !== null) {
            $query->where('uid', '>', $cursorUid);
        }

        foreach ($query->get() as $row) {
            if (! $row instanceof stdClass) {
                continue;
            }

            $record = StorageRowPayload::format($row);

            if (! $this->isPublished($record) || ! $this->matchesFilters($record, $validated)) {
                continue;
            }

            if (count($records) >= $limit) {
                $nextCursor = StorageRowPayload::encodeCursor($lastPublishedUid ?? $row->uid);
                break;
            }

            $records[] = $this->publicRecord($record);
            $lastPublishedUid = $row->uid;
        }

        return response()->json([
            'ok' => true,
            'records' => $records,
            'nextCursor' => $nextCursor,
        ]);
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, mixed> $filters
     */
    private function matchesFilters(array $record, array $filters): bool
    {
        $type = trim((string) ($filters['type'] ?? ''));
        if ($type !== '' && trim((string) ($record['type'] ?? '')) !== $type) {
            return false;
        }

        $tag = $this->normalize(trim((string) ($filters['tag'] ?? '')));
        if ($tag !== '') {
            $tags = array_map(
                fn (mixed $value): string => $this->normalize((string) $value),
                (array) ($record['tags'] ?? []),
            );
            if (! in_array($tag, $tags, true)) {
                return false;
            }
        }

        $query = $this->normalize(trim((string) ($filters['q'] ?? '')));
        if ($query !== '') {
            $haystack = $this->normalize(implode(' ', [
                (string) ($record['title'] ?? ''),
                (string) ($record['description'] ?? ''),
                (string) ($record['type'] ?? ''),
                (string) ($record['subtype'] ?? ''),
                implode(' ', array_map('strval', (array) ($record['tags'] ?? []))),
            ]));

            if (! str_contains($haystack, $query)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param array<string, mixed> $record
     */
    private function isPublished(array $record): bool
    {
        $status = trim((string) ($record['workflowStatus'] ?? $record['status'] ?? ''));

        return $status === 'published';
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private function publicRecord(array $record): array
    {
        return [
            'id' => (string) ($record['id'] ?? $record['uid'] ?? ''),
            'uid' => (string) ($record['uid'] ?? $record['id'] ?? ''),
            'title' => (string) ($record['title'] ?? 'Untitled record'),
            'description' => isset($record['description']) ? (string) $record['description'] : null,
            'type' => isset($record['type']) ? (string) $record['type'] : null,
            'subtype' => isset($record['subtype']) ? (string) $record['subtype'] : null,
            'tags' => $this->publicTags($record['tags'] ?? []),
            'createdAt' => $record['createdAt'] ?? null,
            'updatedAt' => $record['updatedAt'] ?? null,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function publicTags(mixed $tags): array
    {
        if (! is_array($tags)) {
            return [];
        }

        return array_values(array_filter(
            array_map(fn (mixed $tag): string => trim((string) $tag), $tags),
            fn (string $tag): bool => $tag !== '',
        ));
    }

    private function normalize(string $value): string
    {
        return mb_strtolower(trim($value));
    }
}
