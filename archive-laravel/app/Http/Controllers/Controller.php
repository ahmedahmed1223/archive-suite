<?php

namespace App\Http\Controllers;

use App\Models\DelegatedAccess;
use App\Models\User;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

abstract class Controller
{
    /**
     * Return a 403 response unless the authenticated archive user is an admin.
     */
    protected function requireAdmin(Request $request): ?JsonResponse
    {
        return $this->requireAbility($request, 'manage-system');
    }

    /**
     * Return a 403 response unless the authenticated archive user is an editor
     * or admin. Viewer is the default, read-only role (V1-102).
     */
    protected function requireEditor(Request $request): ?JsonResponse
    {
        return $this->requireAbility($request, 'manage-content');
    }

    /**
     * Same as requireEditor(), but a viewer also passes if every id in
     * $itemIds is covered by one of their own active 'editor' delegations
     * (V1-726: temporary access delegation). Lets an editor/admin hand a
     * colleague time-boxed write access to a specific set of records
     * without changing that colleague's global role.
     *
     * @param array<int, string> $itemIds
     */
    protected function requireEditorOrDelegatedAccess(Request $request, array $itemIds): ?JsonResponse
    {
        if ($this->requireAbility($request, 'manage-content') === null) {
            return null;
        }

        $user = $request->attributes->get('archive_user');

        if (! $user instanceof User || $itemIds === []) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        $delegatedIds = DelegatedAccess::query()
            ->active()
            ->where('grantee_id', $user->id)
            ->where('permission', 'editor')
            ->get(['scope'])
            ->flatMap(fn (DelegatedAccess $grant): array => (array) ($grant->scope['itemIds'] ?? []))
            ->all();

        if (array_diff($itemIds, $delegatedIds) !== []) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        return null;
    }

    private function requireAbility(Request $request, string $ability): ?JsonResponse
    {
        $user = $request->attributes->get('archive_user');

        if (! $user instanceof User || Gate::forUser($user)->denies($ability)) {
            return response()->json(ApiError::envelope('Forbidden.', 403), 403);
        }

        return null;
    }
}
