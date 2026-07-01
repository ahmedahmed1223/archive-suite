<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CollaborationLock;
use App\Models\CollaborationPresence;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CollaborationController extends Controller
{
    private const ACTIVE_WINDOW_SECONDS = 45;
    private const DEFAULT_LOCK_TTL_SECONDS = 90;

    public function index(string $roomKey): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'roomKey' => $roomKey,
            'activeWindowSeconds' => self::ACTIVE_WINDOW_SECONDS,
            'participants' => $this->participants($roomKey),
        ]);
    }

    public function heartbeat(Request $request, string $roomKey): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in(['active', 'viewing', 'reviewing', 'editing', 'idle'])],
            'resourceId' => ['nullable', 'string', 'max:255'],
            'cursor' => ['nullable', 'array'],
        ]);

        $user = $request->attributes->get('archive_user');
        if (! $user instanceof User) {
            return response()->json(['ok' => false, 'error' => 'Unauthorized.'], 401);
        }

        $presence = CollaborationPresence::query()->firstOrNew([
            'room_key' => $roomKey,
            'user_id' => $user->id,
        ]);

        if (! $presence->exists) {
            $presence->id = (string) Str::uuid();
        }

        $presence->fill([
            'display_name' => $user->name ?: $user->email,
            'status' => $validated['status'] ?? 'active',
            'resource_id' => $validated['resourceId'] ?? null,
            'cursor' => $validated['cursor'] ?? null,
            'last_seen_at' => now(),
        ]);
        $presence->save();

        return response()->json([
            'ok' => true,
            'roomKey' => $roomKey,
            'activeWindowSeconds' => self::ACTIVE_WINDOW_SECONDS,
            'participants' => $this->participants($roomKey),
        ]);
    }

    public function locks(string $roomKey): JsonResponse
    {
        $this->deleteExpiredLocks($roomKey);

        return response()->json([
            'ok' => true,
            'roomKey' => $roomKey,
            'locks' => $this->activeLocks($roomKey),
        ]);
    }

    public function acquireLock(Request $request, string $roomKey): JsonResponse
    {
        $validated = $request->validate([
            'resourceId' => ['required', 'string', 'max:255'],
            'ttlSeconds' => ['nullable', 'integer', 'min:15', 'max:300'],
        ]);

        $user = $request->attributes->get('archive_user');
        if (! $user instanceof User) {
            return response()->json(['ok' => false, 'error' => 'Unauthorized.'], 401);
        }

        $resourceId = $validated['resourceId'];
        $ttlSeconds = (int) ($validated['ttlSeconds'] ?? self::DEFAULT_LOCK_TTL_SECONDS);
        $this->deleteExpiredLocks($roomKey);

        $lock = CollaborationLock::query()
            ->where('room_key', $roomKey)
            ->where('resource_id', $resourceId)
            ->first();

        if ($lock && (string) $lock->user_id !== (string) $user->id) {
            return response()->json([
                'ok' => false,
                'code' => 'lock_conflict',
                'error' => 'Resource is locked by another collaborator.',
                'lock' => $this->formatLock($lock),
            ], 409);
        }

        $statusCode = $lock ? 200 : 201;
        if (! $lock) {
            $lock = new CollaborationLock([
                'id' => (string) Str::uuid(),
                'room_key' => $roomKey,
                'resource_id' => $resourceId,
                'user_id' => $user->id,
            ]);
        }

        $lock->fill([
            'display_name' => $user->name ?: $user->email,
            'expires_at' => now()->addSeconds($ttlSeconds),
        ]);
        $lock->save();

        return response()->json([
            'ok' => true,
            'roomKey' => $roomKey,
            'lock' => $this->formatLock($lock),
            'locks' => $this->activeLocks($roomKey),
        ], $statusCode);
    }

    public function releaseLock(Request $request, string $roomKey): JsonResponse
    {
        $validated = $request->validate([
            'resourceId' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->attributes->get('archive_user');
        if (! $user instanceof User) {
            return response()->json(['ok' => false, 'error' => 'Unauthorized.'], 401);
        }

        $deleted = CollaborationLock::query()
            ->where('room_key', $roomKey)
            ->where('resource_id', $validated['resourceId'])
            ->where('user_id', $user->id)
            ->delete();

        $this->deleteExpiredLocks($roomKey);

        return response()->json([
            'ok' => true,
            'roomKey' => $roomKey,
            'released' => $deleted > 0,
            'locks' => $this->activeLocks($roomKey),
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function participants(string $roomKey): array
    {
        return CollaborationPresence::query()
            ->where('room_key', $roomKey)
            ->where('last_seen_at', '>=', now()->subSeconds(self::ACTIVE_WINDOW_SECONDS))
            ->orderBy('display_name')
            ->get()
            ->map(fn (CollaborationPresence $presence): array => [
                'id' => $presence->id,
                'roomKey' => $presence->room_key,
                'userId' => (string) $presence->user_id,
                'displayName' => $presence->display_name,
                'status' => $presence->status,
                'resourceId' => $presence->resource_id,
                'cursor' => $presence->cursor,
                'lastSeenAt' => $presence->last_seen_at?->toISOString(),
            ])
            ->values()
            ->all();
    }

    private function deleteExpiredLocks(string $roomKey): void
    {
        CollaborationLock::query()
            ->where('room_key', $roomKey)
            ->where('expires_at', '<=', now())
            ->delete();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function activeLocks(string $roomKey): array
    {
        return CollaborationLock::query()
            ->where('room_key', $roomKey)
            ->where('expires_at', '>', now())
            ->orderBy('resource_id')
            ->get()
            ->map(fn (CollaborationLock $lock): array => $this->formatLock($lock))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatLock(CollaborationLock $lock): array
    {
        return [
            'id' => $lock->id,
            'roomKey' => $lock->room_key,
            'resourceId' => $lock->resource_id,
            'userId' => (string) $lock->user_id,
            'displayName' => $lock->display_name,
            'expiresAt' => $lock->expires_at?->toISOString(),
            'updatedAt' => $lock->updated_at?->toISOString(),
        ];
    }
}
