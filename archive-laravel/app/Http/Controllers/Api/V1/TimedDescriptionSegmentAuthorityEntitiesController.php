<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuthorityEntity;
use App\Models\TimedDescriptionSegment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class TimedDescriptionSegmentAuthorityEntitiesController extends Controller
{
    public function index(string $segmentId): JsonResponse
    {
        if (! TimedDescriptionSegment::query()->whereKey($segmentId)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Timed description segment not found.', 'code' => 'not_found'], 404);
        }

        $links = $this->links($segmentId);

        return response()->json(['ok' => true, 'links' => $links->map(fn (stdClass $row): array => $this->payload($row))->values()]);
    }

    public function store(Request $request, string $segmentId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        if (! TimedDescriptionSegment::query()->whereKey($segmentId)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Timed description segment not found.', 'code' => 'not_found'], 404);
        }

        $data = $request->validate(['entityId' => ['required', 'uuid'], 'relationship' => ['required', 'string', 'max:64']]);
        $entity = AuthorityEntity::query()->whereNull('merged_into_id')->find($data['entityId']);
        if (! $entity) return response()->json(['ok' => false, 'error' => 'Authority entity not found.', 'code' => 'not_found'], 404);

        DB::table('timed_description_segment_authority_entities')->updateOrInsert(
            ['timed_description_segment_id' => $segmentId, 'authority_entity_id' => $entity->id],
            ['id' => (string) Str::uuid(), 'relationship' => $data['relationship'], 'created_by' => $request->attributes->get('archive_user')?->getKey(), 'updated_at' => now(), 'created_at' => now()],
        );
        $row = $this->links($segmentId)->firstWhere('authority_entity_id', $entity->id);

        return response()->json(['ok' => true, 'link' => $this->payload($row)], 201);
    }

    public function destroy(Request $request, string $segmentId, string $entityId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $deleted = DB::table('timed_description_segment_authority_entities')
            ->where('timed_description_segment_id', $segmentId)
            ->where('authority_entity_id', $entityId)
            ->delete();
        if ($deleted < 1) return response()->json(['ok' => false, 'error' => 'Authority link not found.', 'code' => 'not_found'], 404);

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /** @return \Illuminate\Support\Collection<int, stdClass> */
    private function links(string $segmentId): \Illuminate\Support\Collection
    {
        return DB::table('timed_description_segment_authority_entities')
            ->join('authority_entities', 'authority_entities.id', '=', 'timed_description_segment_authority_entities.authority_entity_id')
            ->where('timed_description_segment_authority_entities.timed_description_segment_id', $segmentId)
            ->whereNull('authority_entities.merged_into_id')
            ->orderBy('authority_entities.preferred_label')
            ->get();
    }

    /** @return array<string, mixed> */
    private function payload(stdClass $row): array
    {
        return ['id' => $row->id, 'relationship' => $row->relationship, 'entity' => ['id' => $row->authority_entity_id, 'kind' => $row->kind, 'preferredLabel' => $row->preferred_label, 'aliases' => json_decode((string) $row->aliases, true) ?: []]];
    }
}
