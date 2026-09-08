<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CuratedCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CuratedCollectionsController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['ok' => true, 'collections' => CuratedCollection::query()->latest()->get()->map(fn (CuratedCollection $collection): array => $this->payload($collection))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $data = $request->validate(['title' => ['required', 'string', 'max:500'], 'introduction' => ['nullable', 'string', 'max:5000']]);
        $collection = CuratedCollection::query()->create(['id' => (string) Str::uuid(), 'title' => trim($data['title']), 'introduction' => $data['introduction'] ?? null, 'status' => 'draft', 'created_by' => $request->attributes->get('archive_user')?->getKey()]);
        return response()->json(['ok' => true, 'collection' => $this->payload($collection)], 201);
    }

    /** @return array<string, mixed> */
    private function payload(CuratedCollection $collection): array
    {
        return ['id' => $collection->id, 'title' => $collection->title, 'introduction' => $collection->introduction, 'status' => $collection->status, 'createdAt' => $collection->created_at?->toISOString(), 'updatedAt' => $collection->updated_at?->toISOString()];
    }
}
