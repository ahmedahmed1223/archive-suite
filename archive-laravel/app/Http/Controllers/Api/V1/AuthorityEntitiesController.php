<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuthorityEntity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuthorityEntitiesController extends Controller
{
    /** @var list<string> */
    private const KINDS = ['person', 'organization', 'place', 'program'];

    public function index(Request $request): JsonResponse
    {
        $query = AuthorityEntity::query()->whereNull('merged_into_id')->orderBy('kind')->orderBy('preferred_label');
        $kind = $request->string('kind')->trim()->toString();
        if ($kind !== '') {
            $query->where('kind', $kind);
        }

        return response()->json(['ok' => true, 'entities' => $query->get()->map(fn (AuthorityEntity $entity): array => $this->payload($entity))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $data = $request->validate([
            'kind' => ['required', 'string', 'in:'.implode(',', self::KINDS)],
            'preferredLabel' => ['required', 'string', 'max:500'],
            'aliases' => ['sometimes', 'array', 'max:50'],
            'aliases.*' => ['string', 'max:500'],
        ]);

        $entity = AuthorityEntity::query()->create([
            'id' => (string) Str::uuid(),
            'kind' => $data['kind'],
            'preferred_label' => trim($data['preferredLabel']),
            'aliases' => array_values(array_unique(array_filter($data['aliases'] ?? [], fn (mixed $alias): bool => trim((string) $alias) !== ''))),
            'created_by' => $request->attributes->get('archive_user')?->getKey(),
        ]);

        return response()->json(['ok' => true, 'entity' => $this->payload($entity)], 201);
    }

    /** @return array<string, mixed> */
    private function payload(AuthorityEntity $entity): array
    {
        return ['id' => $entity->id, 'kind' => $entity->kind, 'preferredLabel' => $entity->preferred_label, 'aliases' => $entity->aliases, 'mergedIntoId' => $entity->merged_into_id];
    }
}
