<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class FavoritesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $favorites = DB::table('record_favorites')
            ->where('user_id', $this->userId($request))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $favorite): array => $this->formatFavorite($favorite))
            ->values();

        return response()->json(['ok' => true, 'favorites' => $favorites]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recordId' => ['required', 'string', 'max:100'],
            'store' => ['nullable', 'string', 'max:100'],
        ]);
        $store = $validated['store'] ?? 'archive-items';
        $record = DB::table('storage_rows')->where('store', $store)->where('uid', $validated['recordId'])->first();
        if (! $record) {
            return response()->json(ApiError::envelope('Archive record not found.', 404, 'not_found'), 404);
        }

        $userId = $this->userId($request);
        $favorite = DB::table('record_favorites')
            ->where('user_id', $userId)
            ->where('store', $store)
            ->where('record_id', $validated['recordId'])
            ->first();
        if (! $favorite) {
            $id = (string) Str::uuid();
            $now = now();
            DB::table('record_favorites')->insert([
                'id' => $id,
                'user_id' => $userId,
                'store' => $store,
                'record_id' => $validated['recordId'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $favorite = DB::table('record_favorites')->where('id', $id)->first();
        }

        return response()->json(['ok' => true, 'favorite' => $this->formatFavorite($favorite)], 201);
    }

    public function destroy(Request $request, string $recordId): JsonResponse
    {
        $store = $request->string('store')->trim()->toString() ?: 'archive-items';
        $deleted = DB::table('record_favorites')
            ->where('user_id', $this->userId($request))
            ->where('store', $store)
            ->where('record_id', $recordId)
            ->delete();

        if ($deleted === 0) {
            return response()->json(ApiError::envelope('Favorite not found.', 404, 'not_found'), 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /** @return array<string, mixed> */
    private function formatFavorite(stdClass $favorite): array
    {
        $record = DB::table('storage_rows')->where('store', $favorite->store)->where('uid', $favorite->record_id)->first();
        $data = $record ? json_decode((string) $record->data, true) : [];

        return [
            'recordId' => $favorite->record_id,
            'store' => $favorite->store,
            'title' => is_array($data) ? ($data['title'] ?? null) : null,
            'type' => is_array($data) ? ($data['type'] ?? null) : null,
            'addedAt' => $favorite->created_at,
        ];
    }

    private function userId(Request $request): string
    {
        return (string) $request->attributes->get('archive_user')?->getKey();
    }
}
