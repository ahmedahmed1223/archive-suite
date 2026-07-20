<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserInvitation;
use App\Support\ApiError;
use App\Support\ApiToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UsersController extends Controller
{
    private const ROLES = ['admin', 'editor', 'viewer'];

    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $users = User::query()->orderBy('name')->get()->map(fn (User $user) => $this->formatUser($user));

        $invitations = UserInvitation::query()
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (UserInvitation $invitation) => $this->formatInvitation($invitation));

        return response()->json(['ok' => true, 'users' => $users->values(), 'invitations' => $invitations->values()]);
    }

    /**
     * V1-721: lightweight directory for the @-mention picker in notes/comments.
     * Deliberately open to every authenticated role (editor/viewer included) —
     * mentioning a teammate isn't an admin action — and returns only
     * {id, name}, no email/role, unlike the admin-only index() above.
     */
    public function mentionable(Request $request): JsonResponse
    {
        $users = User::query()->orderBy('name')->get(['id', 'name'])
            ->map(fn (User $user): array => ['id' => (string) $user->id, 'name' => $user->name])
            ->values();

        return response()->json(['ok' => true, 'users' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'email' => ['required', 'email'],
            'role' => ['required', Rule::in(self::ROLES)],
        ]);

        if (User::query()->where('email', $validated['email'])->exists()) {
            return response()->json(['ok' => false, 'error' => 'A user with this email already exists.'], 422);
        }

        $token = ApiToken::create();
        $invitation = UserInvitation::query()->create([
            'id' => (string) Str::uuid(),
            'email' => $validated['email'],
            'role' => $validated['role'],
            'token_hash' => ApiToken::hash($token),
            'invited_by' => $request->attributes->get('archive_user')->id,
            'expires_at' => now()->addDays(7),
        ]);

        return response()->json([
            'ok' => true,
            'invitation' => $this->formatInvitation($invitation),
            'token' => $token,
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'role' => ['required', Rule::in(self::ROLES)],
        ]);

        $user = User::query()->find($id);

        if (! $user) {
            return response()->json(['ok' => false, 'error' => 'User not found.'], 404);
        }

        if ($user->role === 'admin' && $validated['role'] !== 'admin' && $this->countAdmins() <= 1) {
            return response()->json(
                ApiError::envelope('Cannot demote the last remaining admin.', 422, ApiError::LAST_ADMIN_PROTECTED),
                422
            );
        }

        $user->update(['role' => $validated['role']]);

        return response()->json(['ok' => true, 'user' => $this->formatUser($user)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $actingUser = $request->attributes->get('archive_user');
        $user = User::query()->find($id);

        if (! $user) {
            return response()->json(['ok' => false, 'error' => 'User not found.'], 404);
        }

        if ($user->role === 'admin' && $this->countAdmins() <= 1) {
            return response()->json(
                ApiError::envelope('Cannot remove the last remaining admin.', 422, ApiError::LAST_ADMIN_PROTECTED),
                422
            );
        }

        if ($actingUser instanceof User && $actingUser->id === $user->id) {
            return response()->json(['ok' => false, 'error' => 'You cannot remove your own account.'], 422);
        }

        $user->delete();

        return response()->json(['ok' => true]);
    }

    private function countAdmins(): int
    {
        return User::query()->where('role', 'admin')->count();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatUser(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'createdAt' => $user->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatInvitation(UserInvitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'email' => $invitation->email,
            'role' => $invitation->role,
            'expiresAt' => $invitation->expires_at->toIso8601String(),
            'createdAt' => $invitation->created_at?->toIso8601String(),
        ];
    }
}
