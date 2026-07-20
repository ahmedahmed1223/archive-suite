<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DelegatedAccess;
use App\Models\User;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DelegatedAccessController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $actor = $request->attributes->get('archive_user');

        $validated = $request->validate([
            'granteeId' => ['required', 'integer', Rule::exists('users', 'id')],
            'scope' => ['required', 'array'],
            'scope.itemIds' => ['required', 'array', 'min:1'],
            'scope.itemIds.*' => ['string'],
            'permission' => ['nullable', 'string', Rule::in(['editor'])],
            'expiresAt' => ['required', 'date', 'after:now'],
        ]);

        if ($actor instanceof User && (int) $validated['granteeId'] === $actor->id) {
            return response()->json(ApiError::envelope('Cannot delegate access to yourself.', 422), 422);
        }

        $grant = DelegatedAccess::query()->create([
            'grantor_id' => $actor instanceof User ? $actor->id : null,
            'grantee_id' => $validated['granteeId'],
            'scope' => $validated['scope'],
            'permission' => $validated['permission'] ?? 'editor',
            'expires_at' => $validated['expiresAt'],
        ]);

        return response()->json(['ok' => true, 'delegation' => $this->present($grant)], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->attributes->get('archive_user');

        if (! $actor instanceof User) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        $direction = $request->query('direction', 'granted') === 'received' ? 'received' : 'granted';
        $column = $direction === 'received' ? 'grantee_id' : 'grantor_id';

        $delegations = DelegatedAccess::query()
            ->where($column, $actor->id)
            ->with(['grantor:id,name,email', 'grantee:id,name,email'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (DelegatedAccess $grant): array => $this->present($grant))
            ->values()
            ->all();

        return response()->json(['ok' => true, 'delegations' => $delegations]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $actor = $request->attributes->get('archive_user');
        $grant = DelegatedAccess::query()->find($id);

        if (! $actor instanceof User || ! $grant instanceof DelegatedAccess) {
            return response()->json(ApiError::envelope('Delegation not found.', 404), 404);
        }

        $isGrantor = $grant->grantor_id === $actor->id;
        $isAdmin = $this->requireAdmin($request) === null;

        if (! $isGrantor && ! $isAdmin) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        if ($grant->revoked_at === null) {
            $grant->revoked_at = now();
            $grant->save();
        }

        return response()->json(['ok' => true, 'delegation' => $this->present($grant->fresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(DelegatedAccess $grant): array
    {
        return [
            'id' => $grant->id,
            'grantor' => $grant->relationLoaded('grantor') && $grant->grantor
                ? ['id' => $grant->grantor->id, 'name' => $grant->grantor->name, 'email' => $grant->grantor->email]
                : ['id' => $grant->grantor_id],
            'grantee' => $grant->relationLoaded('grantee') && $grant->grantee
                ? ['id' => $grant->grantee->id, 'name' => $grant->grantee->name, 'email' => $grant->grantee->email]
                : ['id' => $grant->grantee_id],
            'scope' => $grant->scope,
            'permission' => $grant->permission,
            'expiresAt' => $grant->expires_at?->toISOString(),
            'revokedAt' => $grant->revoked_at?->toISOString(),
            'status' => $grant->revoked_at !== null ? 'revoked' : ($grant->isActive() ? 'active' : 'expired'),
        ];
    }
}
