<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\ReviewSession;
use App\Models\RightsRecord;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * V3-WORK-001: the unified work inbox. Aggregates FOUR existing data
 * sources into one paginated, filterable feed for the current user — it is
 * a read/query surface, not a new store: nothing here is copied or
 * denormalized, every item links back to its real source record.
 *
 * Isolation: every source is scoped to the authenticated user (own
 * project-task assignments, own/reviewable review sessions, own
 * notifications). Rights-expiry is pre-existing global governance data with
 * no per-user or per-department owner anywhere in the schema today (see
 * RightsController::expiring, which is likewise unscoped) — surfacing it
 * here is gated behind the same "manage-content" ability that already
 * governs it and introduces no new exposure. True department-level
 * isolation is not enforced because Archive Suite has no user→department
 * membership model yet; only a handful of workflow-routing tables
 * (inbox_items, record_field_requests) carry a department_id tag, and none
 * of the four sources aggregated here do. Documented as a known limitation
 * rather than fabricated with speculative schema.
 */
final class WorkInboxController extends Controller
{
    private const TYPES = ['task', 'review', 'rights', 'notification'];

    private const SOURCE_LIMIT = 200;

    private const RIGHTS_EXPIRY_WINDOW_DAYS = 30;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'types' => ['nullable', 'array'],
            'types.*' => ['string', Rule::in(self::TYPES)],
        ]);

        $user = $this->currentUser($request);
        $types = $validated['types'] ?? self::TYPES;
        $canReview = Gate::forUser($user)->allows('manage-content');

        $items = collect();
        if (in_array('task', $types, true)) {
            $items = $items->concat($this->pendingTasks($user));
        }
        if (in_array('review', $types, true)) {
            $items = $items->concat($this->pendingReviews($user, $canReview));
        }
        if (in_array('rights', $types, true) && $canReview) {
            $items = $items->concat($this->expiringRights());
        }
        if (in_array('notification', $types, true)) {
            $items = $items->concat($this->unreadNotifications($user));
        }

        $counts = $items->countBy('type');
        $sorted = $this->sortByUrgency($items);

        $limit = (int) ($validated['limit'] ?? 20);
        $page = (int) ($validated['page'] ?? 1);
        $total = $sorted->count();
        $paged = $sorted->slice(($page - 1) * $limit, $limit)->values();

        return response()->json([
            'ok' => true,
            'items' => $paged,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'hasMore' => $page * $limit < $total,
            ],
            'counts' => [
                'task' => $counts->get('task', 0),
                'review' => $counts->get('review', 0),
                'rights' => $counts->get('rights', 0),
                'notification' => $counts->get('notification', 0),
            ],
        ]);
    }

    /**
     * Items with a due date sort soonest-first; the rest fall back to
     * newest-first by creation time.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function sortByUrgency(Collection $items): Collection
    {
        return $items->sort(function (array $a, array $b): int {
            $aHasDue = $a['dueAt'] !== null;
            $bHasDue = $b['dueAt'] !== null;

            if ($aHasDue && $bHasDue) {
                return $a['dueAt'] <=> $b['dueAt'];
            }
            if ($aHasDue !== $bHasDue) {
                return $aHasDue ? -1 : 1;
            }

            return ($b['createdAt'] ?? '') <=> ($a['createdAt'] ?? '');
        })->values();
    }

    /**
     * project_tasks has no user_id FK (assignee is a free-text label, see
     * ProjectTasksController) — matched case-insensitively against the
     * caller's own name/email so a task can never surface for anyone else.
     *
     * @return array<int, array<string, mixed>>
     */
    private function pendingTasks(User $user): array
    {
        $identities = array_values(array_unique(array_filter([
            $user->email ? mb_strtolower((string) $user->email) : null,
            $user->name ? mb_strtolower((string) $user->name) : null,
        ])));

        if ($identities === []) {
            return [];
        }

        return DB::table('project_tasks')
            ->where('status', '!=', 'done')
            ->where(function ($query) use ($identities): void {
                foreach ($identities as $identity) {
                    $query->orWhereRaw('LOWER(assignee) = ?', [$identity]);
                }
            })
            ->orderBy('due_date')
            ->limit(self::SOURCE_LIMIT)
            ->get()
            ->map(fn (object $row): array => [
                'id' => "task:{$row->id}",
                'type' => 'task',
                'title' => $row->title,
                'status' => $row->status,
                'dueAt' => $row->due_date,
                'createdAt' => $row->created_at,
                'href' => '/project-tasks?projectId='.rawurlencode((string) $row->project_id),
                'meta' => ['projectId' => $row->project_id, 'recordId' => $row->record_id],
            ])
            ->all();
    }

    /**
     * "Pending for me" covers two cases the schema actually supports: a
     * session I submitted that is still awaiting a decision (created_by =
     * me), and — only for callers who can act on it — any session currently
     * open for review. review_sessions has no per-reviewer assignment
     * column, so a narrower "assigned to me as reviewer" filter isn't
     * expressible today.
     *
     * @return array<int, array<string, mixed>>
     */
    private function pendingReviews(User $user, bool $canReview): array
    {
        return ReviewSession::query()
            ->whereIn('state', [ReviewSession::STATE_IN_REVIEW, ReviewSession::STATE_CHANGES_REQUESTED])
            ->where(function ($query) use ($user, $canReview): void {
                $query->where('created_by', $user->id);
                if ($canReview) {
                    $query->orWhere('state', ReviewSession::STATE_IN_REVIEW);
                }
            })
            ->orderByDesc('updated_at')
            ->limit(self::SOURCE_LIMIT)
            ->get()
            ->map(fn (ReviewSession $session): array => [
                'id' => "review:{$session->id}",
                'type' => 'review',
                'title' => $session->record_uid,
                'status' => $session->state,
                'dueAt' => null,
                'createdAt' => $session->created_at?->toISOString(),
                'href' => '/archive/'.rawurlencode($session->record_uid).'?store='.rawurlencode($session->record_store),
                'meta' => [
                    'recordStore' => $session->record_store,
                    'recordUid' => $session->record_uid,
                    'mine' => $session->created_by === $user->id,
                ],
            ])
            ->all();
    }

    /**
     * rights_records carries no owner column at all (see RightsRecord) —
     * this reuses the same globally-scoped query RightsController::expiring
     * already exposes to any authenticated caller, just gated to editors so
     * the work inbox doesn't hand it to viewers who couldn't act on it
     * anyway.
     *
     * @return array<int, array<string, mixed>>
     */
    private function expiringRights(): array
    {
        $cutoff = now()->addDays(self::RIGHTS_EXPIRY_WINDOW_DAYS);

        return RightsRecord::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '>', now())
            ->where('expires_at', '<=', $cutoff)
            ->orderBy('expires_at')
            ->limit(self::SOURCE_LIMIT)
            ->get()
            ->map(fn (RightsRecord $record): array => [
                'id' => "rights:{$record->id}",
                'type' => 'rights',
                'title' => $record->item_id,
                'status' => 'expiring',
                'dueAt' => $record->expires_at?->toISOString(),
                'createdAt' => $record->created_at?->toISOString(),
                'href' => '/rights?itemId='.rawurlencode($record->item_id),
                'meta' => ['itemId' => $record->item_id, 'rightsHolder' => $record->rights_holder],
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function unreadNotifications(User $user): array
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->where('is_read', false)
            ->orderByDesc('created_at')
            ->limit(self::SOURCE_LIMIT)
            ->get()
            ->map(fn (Notification $notification): array => [
                'id' => "notification:{$notification->id}",
                'type' => 'notification',
                'title' => $notification->title,
                'status' => $notification->type,
                'dueAt' => null,
                'createdAt' => $notification->created_at?->toISOString(),
                'href' => '/notifications',
                'meta' => ['notificationId' => $notification->id],
            ])
            ->all();
    }

    private function currentUser(Request $request): User
    {
        // ponytail: no defensive null-check — archive.auth guarantees this
        // attribute is set before the route ever reaches the controller
        // (see NotificationsController for the same trust boundary).
        return $request->attributes->get('archive_user');
    }
}
