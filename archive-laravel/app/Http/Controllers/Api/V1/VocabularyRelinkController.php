<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

// V1-850: instead of a deleted/changed vocabulary term silently leaving a
// broken tag reference on every record that used it, this shows the affected
// records first and relinks (replace or remove) as one reviewed step.
// ponytail: full storage_rows scan — this is an infrequent admin action, not
// a hot path; add a tags index/lookup table if the archive grows large enough
// for this to matter.
class VocabularyRelinkController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    public function preview(string $id): JsonResponse
    {
        $term = DB::table('vocabulary_terms')->where('id', $id)->first();
        if (! $term) {
            return $this->notFound();
        }

        $affected = $this->affectedRecords($term->term);

        return response()->json(['ok' => true, 'term' => $term->term, 'affectedCount' => $affected->count(), 'records' => $affected->values()]);
    }

    public function relink(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $term = DB::table('vocabulary_terms')->where('id', $id)->first();
        if (! $term) {
            return $this->notFound();
        }

        $validated = $request->validate([
            'replacement' => ['nullable', 'string', 'max:200'],
        ]);
        $replacement = isset($validated['replacement']) ? trim($validated['replacement']) : null;
        $replacement = $replacement === '' ? null : $replacement;

        $relinked = [];
        foreach (DB::table('storage_rows')->where('store', self::ARCHIVE_STORE)->get() as $row) {
            $data = json_decode($row->data, true) ?? [];
            $tags = array_values(array_filter((array) ($data['tags'] ?? []), 'is_string'));
            if (! in_array($term->term, $tags, true)) {
                continue;
            }

            $newTags = array_values(array_unique(array_filter(
                array_map(fn (string $tag): ?string => $tag === $term->term ? $replacement : $tag, $tags)
            )));
            $data['tags'] = $newTags;

            DB::table('storage_rows')->where('store', $row->store)->where('uid', $row->uid)->update([
                'data' => json_encode($data, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);
            $relinked[] = $row->uid;
        }

        DB::table('vocabulary_terms')->where('id', $id)->delete();

        return response()->json(['ok' => true, 'relinked' => $relinked, 'replacement' => $replacement]);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function affectedRecords(string $term)
    {
        return DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->get()
            ->map(function (stdClass $row) {
                $data = json_decode($row->data, true) ?? [];

                return ['uid' => $row->uid, 'title' => $data['title'] ?? $row->uid, 'tags' => $data['tags'] ?? []];
            })
            ->filter(fn (array $record): bool => in_array($term, (array) $record['tags'], true))
            ->map(fn (array $record): array => ['id' => $record['uid'], 'title' => $record['title']]);
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Vocabulary term not found.', 'code' => 'not_found'], 404);
    }
}
