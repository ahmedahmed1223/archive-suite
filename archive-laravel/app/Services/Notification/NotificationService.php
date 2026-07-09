<?php

declare(strict_types=1);

namespace App\Services\Notification;

use App\Models\Notification;
use App\Models\User;

class NotificationService
{
    public function createIngestNotification(User $user, int $ingested, int $skipped): Notification
    {
        return Notification::create([
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

        return Notification::create([
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

        return Notification::create([
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
            ? sprintf('تم استعادة النسخة الاحتياطية بنجاح: %s', $backupName ?? 'نسخة احتياطية')
            : sprintf('فشلت استعادة النسخة الاحتياطية: %s', $error ?? 'خطأ غير معروف');

        return Notification::create([
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

    public function getUnreadCount(User $user): int
    {
        return Notification::where('user_id', $user->id)
            ->where('is_read', false)
            ->count();
    }
}
