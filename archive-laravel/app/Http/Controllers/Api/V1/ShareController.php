<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ShareLink;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;

class ShareController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'scope' => ['required', 'array'],
            'scope.itemIds' => ['nullable', 'array'],
            'scope.itemIds.*' => ['string'],
            'scope.collectionIds' => ['nullable', 'array'],
            'scope.collectionIds.*' => ['string'],
            'permission' => ['nullable', 'string', Rule::in(['view', 'comment'])],
            'expiresAt' => ['nullable', 'date'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        $token = Str::random(40);
        $share = ShareLink::query()->create([
            'token' => $token,
            'scope' => $validated['scope'],
            'permission' => $validated['permission'] ?? 'view',
            'expires_at' => $validated['expiresAt'] ?? null,
            'password_hash' => isset($validated['password']) ? Hash::make($validated['password']) : null,
        ]);

        return response()->json([
            'ok' => true,
            'token' => $share->token,
            'url' => url('/api/v1/share/'.$share->token),
            'path' => '/share/'.$share->token,
            'expiresAt' => $share->expires_at?->toISOString(),
        ], 201);
    }

    public function show(Request $request, string $token): JsonResponse
    {
        $share = ShareLink::query()->where('token', $token)->first();

        if (! $share || ($share->expires_at && $share->expires_at->isPast())) {
            return response()->json(['ok' => false, 'error' => 'Share link not found.'], 404);
        }

        if ($share->password_hash) {
            // ponytail: query fallback kept for existing links during transition; drop in v1.1.
            $password = $request->header('X-Share-Password') ?? $request->query('password');

            if (! Hash::check((string) $password, $share->password_hash)) {
                return response()->json(['ok' => false, 'error' => 'Share password is required.'], 401);
            }
        }

        return response()->json([
            'ok' => true,
            'scope' => $share->scope,
            'records' => $this->recordsForScope($share->scope ?? []),
            'permission' => $share->permission,
            'comments' => [],
        ]);
    }

    /**
     * @param array<string, mixed> $scope
     * @return array<int, array<string, mixed>>
     */
    private function recordsForScope(array $scope): array
    {
        $itemIds = array_values(array_filter((array) ($scope['itemIds'] ?? []), 'is_string'));

        if ($itemIds === []) {
            return [];
        }

        return DB::table('storage_rows')
            ->whereIn('uid', $itemIds)
            ->orderBy('uid')
            ->get()
            ->map(fn (stdClass $row): array => StorageRowPayload::format($row))
            ->values()
            ->all();
    }
}
