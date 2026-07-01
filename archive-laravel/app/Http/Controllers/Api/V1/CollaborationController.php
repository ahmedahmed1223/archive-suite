<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CollaborationPresence;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CollaborationController extends Controller
{
    private const ACTIVE_WINDOW_SECONDS = 45;

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
}
