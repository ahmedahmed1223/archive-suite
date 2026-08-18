<?php

declare(strict_types=1);

namespace App\Services\Notification;

use App\Events\UserNotificationCreated;
use App\Models\Notification;
use App\Models\User;
use App\Models\UserExperienceProfile;
use Illuminate\Support\Facades\Event;

class NotificationService
{
    public function createIngestNotification(User $user, int $ingested, int $skipped): Notification
    {
        return $this->record([
            'user_id' => $user->id,
            'type' => 'ingest_complete',
            'title' => 'اكتمل الإدراج',
            'message' => sprintf('تم إدراج %d ملفات بنجاح (%d تم تخطيها)', $ingested, $skipped),
            'metadata' => [
                'ingested' => $ingested,
                'skipped' => $skipped,
            ],
        ]);
    }

    public function createBackupNotification(User $user, bool $success, ?string $name = null, ?string $error = null): Notification
    {
        $title = $success ? 'اكتمل النسخ الاحتياطي' : 'فشل النسخ الاحتياطي';
        $message = $success
            ? sprintf('اكتمل النسخ الاحتياطي بنجاح: %s', $name ?? 'نسخة احتياطية جديدة')
            : sprintf('فشل النسخ الاحتياطي: %s', $error ?? 'خطأ غير معروف');

        return $this->record([
            'user_id' => $user->id,
            'type' => 'backup_result',
            'title' => $title,
            'message' => $message,
            'metadata' => [
                'success' => $success,
                'name' => $name,
                'error' => $error,
            ],
        ]);
    }

    public function createShareNotification(User $user, string $action, ?string $title = null, ?string $details = null): Notification
    {
        $notificationTitle = 'إشارة مشاركة';
        $message = match ($action) {
            'created' => sprintf('تم إنشاء رابط مشاركة جديد: %s', $title ?? 'مشاركة جديدة'),
            'accessed' => sprintf('تم الوصول إلى رابط المشاركة: %s', $title ?? 'مشاركة'),
            'expired' => sprintf('انتهت صلاحية رابط المشاركة: %s', $title ?? 'مشاركة'),
            default => sprintf('حدث تغيير في المشاركة: %s', $title ?? 'مشاركة'),
        };

        return $this->record([
            'user_id' => $user->id,
            'type' => 'share_event',
            'title' => $notificationTitle,
            'message' => $message,
            'metadata' => [
                'action' => $action,
                'title' => $title,
                'details' => $details,
            ],
        ]);
    }

    public function createRestoreNotification(User $user, bool $success, ?string $backupName = null, ?string $error = null): Notification
    {
        $title = $success ? 'اكتملت استعادة النسخة الاحتياطية' : 'فشلت استعادة النسخة الاحتياطية';
        $message = $success
            ? sprintf('تمت استعادة النسخة الاحتياطية بنجاح: %s', $backupName ?? 'نسخة احتياطية')
            : sprintf('فشلت استعادة النسخة الاحتياطية: %s', $error ?? 'خطأ غير معروف');

        return $this->record([
            'user_id' => $user->id,
            'type' => 'restore_result',
            'title' => $title,
            'message' => $message,
            'metadata' => [
                'success' => $success,
                'backupName' => $backupName,
                'error' => $error,
            ],
        ]);
    }

    public function createMentionNotification(User $mentioned, User $author, string $context, string $recordId, string $store, string $excerpt): Notification
    {
        $contextLabel = $context === 'comment' ? 'تعليق' : 'ملاحظة';

        return $this->record([
            'user_id' => $mentioned->id,
            'type' => 'mention',
            'title' => sprintf('أشار إليك %s في %s', $author->name, $contextLabel),
            'message' => $excerpt,
            'metadata' => [
                'authorId' => (string) $author->id,
                'authorName' => $author->name,
                'context' => $context,
                'recordId' => $recordId,
                'store' => $store,
            ],
        ]);
    }

    /**
     * V3-WORK-002: OPTIONAL - only sent if the assignee opted in via
     * experience.notifications.optional (see isOptedIn()). This is the
     * "approaching deadline" notice; it must stay skippable so it never
     * competes with the mandatory overdue escalation below.
     */
    public function createTaskDueSoonNotification(User $user, string $taskId, string $taskTitle, string $targetDeadlineAt): ?Notification
    {
        if (! $this->isOptedIn($user, 'taskDueSoon')) {
            return null;
        }

        return $this->record([
            'user_id' => $user->id,
            'type' => 'task_due_soon',
            'title' => 'اقتراب الموعد المستهدف للمهمة',
            'message' => sprintf('المهمة "%s" تقترب من موعدها المستهدف (%s)', $taskTitle, $targetDeadlineAt),
            'metadata' => ['taskId' => $taskId, 'targetDeadlineAt' => $targetDeadlineAt],
        ]);
    }

    /**
     * V3-WORK-002: MANDATORY - deliberately does not call isOptedIn(). An
     * overdue SLA breach must always reach the assignee; see isOptedIn()'s
     * docblock for why this is the reused mandatory/optional boundary
     * rather than a new flag.
     */
    public function createTaskEscalationNotification(User $user, string $taskId, string $taskTitle, string $targetDeadlineAt): Notification
    {
        return $this->record([
            'user_id' => $user->id,
            'type' => 'task_escalation',
            'title' => 'مهمة تجاوزت الموعد المستهدف',
            'message' => sprintf('تجاوزت المهمة "%s" موعدها المستهدف (%s)', $taskTitle, $targetDeadlineAt),
            'metadata' => ['taskId' => $taskId, 'targetDeadlineAt' => $targetDeadlineAt],
        ]);
    }

    /**
     * V3-WORK-002: the mandatory/optional boundary already existed
     * implicitly before this method - every notification type this service
     * created before it (ingest_complete, backup_result, share_event,
     * restore_result, mention) is sent unconditionally; none of them ever
     * consulted a preference, which makes them mandatory by construction.
     * archive-settings.php's experience.notifications.optional enum is the
     * one place a user can opt IN to a specific event. This helper is the
     * only gate that consults it - call it for a new optional-classified
     * type; skip it (as every mandatory notification does) to keep a type
     * mandatory. Reusing this boundary, rather than adding a parallel
     * `mandatory: bool` column, is what guarantees a mandatory alert can
     * never be hidden by a preference: there is no flag on the mandatory
     * path for a preference to check.
     */
    private function isOptedIn(User $user, string $event): bool
    {
        $profile = UserExperienceProfile::query()->find($user->getKey());
        $stored = is_array($profile?->settings) ? $profile->settings : [];
        $notifications = is_array($stored['notifications'] ?? null) ? $stored['notifications'] : [];
        $optional = is_array($notifications['optional'] ?? null) ? $notifications['optional'] : [];

        return in_array($event, $optional, true);
    }

    /**
     * Single choke point for every notification type above: create the row,
     * then broadcast it live (RT-804) so useNotifications on the frontend
     * doesn't wait for its 30s poll. One place so a new notification type
     * can never forget to broadcast.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function record(array $attributes): Notification
    {
        $notification = Notification::create($attributes);

        Event::dispatch(new UserNotificationCreated((string) $attributes['user_id'], $notification->toArray()));

        return $notification;
    }

    public function getUnreadCount(User $user): int
    {
        return Notification::where('user_id', $user->id)
            ->where('is_read', false)
            ->count();
    }
}
