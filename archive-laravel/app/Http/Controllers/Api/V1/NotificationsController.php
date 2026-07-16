<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $limit = (int) ($validated['limit'] ?? 20);
        $page = (int) ($validated['page'] ?? 1);
        $userId = $this->archiveUserId($request);

        $notifications = Notification::where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->paginate($limit, ['*'], 'page', $page);

        return response()->json([
            'ok' => true,
            'notifications' => $notifications->items(),
            'pagination' => [
                'total' => $notifications->total(),
                'page' => $notifications->currentPage(),
                'limit' => $limit,
                'hasMore' => $notifications->hasMorePages(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $userId = $this->archiveUserId($request);
        $notification = Notification::where('user_id', $userId)->find($id);

        if (!$notification) {
            return response()->json(['ok' => false, 'error' => 'Notification not found'], 404);
        }

        return response()->json(['ok' => true, 'notification' => $notification]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $userId = $this->archiveUserId($request);
        $notification = Notification::where('user_id', $userId)->find($id);

        if (!$notification) {
            return response()->json(['ok' => false, 'error' => 'Notification not found'], 404);
        }

        $notification->update(['is_read' => true]);

        return response()->json(['ok' => true, 'notification' => $notification]);
    }

    public function markUnread(Request $request, int $id): JsonResponse
    {
        $userId = $this->archiveUserId($request);
        $notification = Notification::where('user_id', $userId)->find($id);

        if (!$notification) {
            return response()->json(['ok' => false, 'error' => 'Notification not found'], 404);
        }

        $notification->update(['is_read' => false]);

        return response()->json(['ok' => true, 'notification' => $notification]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $userId = $this->archiveUserId($request);

        Notification::where('user_id', $userId)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $userId = $this->archiveUserId($request);
        $notification = Notification::where('user_id', $userId)->find($id);

        if (!$notification) {
            return response()->json(['ok' => false, 'error' => 'Notification not found'], 404);
        }

        $notification->delete();

        return response()->json(['ok' => true]);
    }

    private function archiveUserId(Request $request): int
    {
        return (int) $request->attributes->get('archive_user')->getKey();
    }
}
