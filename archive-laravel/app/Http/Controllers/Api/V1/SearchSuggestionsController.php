<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

class SearchSuggestionsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:8'],
        ]);
        $needle = mb_strtolower(trim($validated['q']));
        $limit = (int) ($validated['limit'] ?? 8);
        $records = DB::table('storage_rows')->orderBy('uid')->get()
            ->map(fn (stdClass $row): array => StorageRowPayload::format($row));
        $suggestions = [];

        foreach ($records as $record) {
            $title = trim((string) ($record['title'] ?? ''));
            if ($title !== '' && str_contains(mb_strtolower($title), $needle)) {
                $suggestions[] = ['kind' => 'record', 'label' => $title, 'value' => $title, 'recordId' => $record['id']];
            }
        }
        foreach ($records as $record) {
            foreach ((array) ($record['tags'] ?? []) as $tag) {
                $value = trim((string) $tag);
                if ($value !== '' && str_contains(mb_strtolower($value), $needle)) $suggestions[] = ['kind' => 'tag', 'label' => $value, 'value' => $value];
            }
            $type = trim((string) ($record['type'] ?? ''));
            if ($type !== '' && str_contains(mb_strtolower($type), $needle)) $suggestions[] = ['kind' => 'type', 'label' => $type, 'value' => $type];
        }

        return response()->json(['ok' => true, 'suggestions' => collect($suggestions)->unique(fn (array $item) => $item['kind'].':'.$item['value'])->take($limit)->values()]);
    }
}
