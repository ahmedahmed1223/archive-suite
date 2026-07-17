<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\SsrfGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;

/**
 * V1-759: admin-managed webhook subscriptions. The raw signing secret is
 * generated here and returned exactly once in the store() response; only
 * SHA-256(secret) is persisted (see DeliverWebhook for how that hash doubles
 * as the HMAC key on every future delivery).
 */
class WebhooksController extends Controller
{
    public const EVENTS = [
        'record.created',
        'record.updated',
        'record.deleted',
        'media_job.completed',
        'media_job.failed',
    ];

    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $subscriptions = DB::table('webhook_subscriptions')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatSubscription($row))
            ->values();

        return response()->json(['ok' => true, 'webhooks' => $subscriptions]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:200'],
            'url' => ['required', 'string', 'max:2048', 'url'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => [Rule::in(self::EVENTS)],
        ]);

        if (! SsrfGuard::isPublicHttpUrl($validated['url'])) {
            return response()->json([
                'ok' => false,
                'error' => 'Webhook URL must be a public http(s) address, not a loopback or private-range host.',
            ], 422);
        }

        $admin = $request->attributes->get('archive_user');
        $now = now();
        $id = (string) Str::uuid();
        $secret = Str::random(48);

        DB::table('webhook_subscriptions')->insert([
            'id' => $id,
            'name' => $validated['name'] ?? null,
            'url' => $validated['url'],
            'events' => json_encode(array_values($validated['events']), JSON_THROW_ON_ERROR),
            'secret_hash' => hash('sha256', $secret),
            'active' => true,
            'consecutive_failures' => 0,
            'last_delivered_at' => null,
            'created_by' => $admin?->getKey(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $row = DB::table('webhook_subscriptions')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'webhook' => $this->formatSubscription($row),
            'secret' => $secret,
        ], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $deleted = DB::table('webhook_subscriptions')->where('id', $id)->delete();

        if ($deleted === 0) {
            return response()->json(['ok' => false, 'error' => 'Webhook subscription not found.'], 404);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatSubscription(stdClass $row): array
    {
        return [
            'id' => $row->id,
            'name' => $row->name,
            'url' => $row->url,
            'events' => json_decode((string) $row->events, true) ?? [],
            'active' => (bool) $row->active,
            'consecutiveFailures' => (int) $row->consecutive_failures,
            'lastDeliveredAt' => $row->last_delivered_at,
            'createdAt' => $row->created_at,
        ];
    }
}
