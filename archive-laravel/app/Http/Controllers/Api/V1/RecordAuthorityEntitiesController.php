<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuthorityEntity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class RecordAuthorityEntitiesController extends Controller
{
    public function index(string $recordId): JsonResponse
    {
        $links = DB::table('record_authority_entities')->join('authority_entities', 'authority_entities.id', '=', 'record_authority_entities.authority_entity_id')
            ->where('record_authority_entities.record_id', $recordId)->whereNull('authority_entities.merged_into_id')->orderBy('authority_entities.preferred_label')->get();

        return response()->json(['ok' => true, 'links' => $links->map(fn (stdClass $row): array => $this->payload($row))->values()]);
    }

    public function store(Request $request, string $recordId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $data = $request->validate(['entityId' => ['required', 'uuid'], 'relationship' => ['required', 'string', 'max:64']]);
        $entity = AuthorityEntity::query()->whereNull('merged_into_id')->find($data['entityId']);
        if (! $entity) {
            return response()->json(['ok' => false, 'error' => 'Authority entity not found.', 'code' => 'not_found'], 404);
        }
        DB::table('record_authority_entities')->updateOrInsert(['record_id' => $recordId, 'authority_entity_id' => $entity->id], ['id' => (string) Str::uuid(), 'relationship' => $data['relationship'], 'created_by' => $request->attributes->get('archive_user')?->getKey(), 'updated_at' => now(), 'created_at' => now()]);
        $row = DB::table('record_authority_entities')->join('authority_entities', 'authority_entities.id', '=', 'record_authority_entities.authority_entity_id')->where('record_authority_entities.record_id', $recordId)->where('authority_entities.id', $entity->id)->first();

        return response()->json(['ok' => true, 'link' => $this->payload($row)], 201);
    }

    public function destroy(Request $request, string $recordId, string $entityId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }
        $deleted = DB::table('record_authority_entities')->where('record_id', $recordId)->where('authority_entity_id', $entityId)->delete();
        if ($deleted < 1) {
            return response()->json(['ok' => false, 'error' => 'Authority link not found.', 'code' => 'not_found'], 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /** @return array<string, mixed> */
    private function payload(stdClass $row): array
    {
        return ['id' => $row->id, 'relationship' => $row->relationship, 'entity' => ['id' => $row->authority_entity_id, 'kind' => $row->kind, 'preferredLabel' => $row->preferred_label, 'aliases' => json_decode((string) $row->aliases, true) ?: []]];
    }
}
