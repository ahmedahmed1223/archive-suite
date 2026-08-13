<?php

declare(strict_types=1);

use App\Models\MediaJob;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

// ponytail: room membership isn't tracked separately from presence heartbeats,
// so any authenticated archive user may subscribe to any room. Tighten to
// per-room membership checks if collaboration rooms gain access control.
Broadcast::channel('collaboration.room.{roomKey}', function ($request, string $roomKey) {
    $user = $request->attributes->get('archive_user');

    if (! $user instanceof User) {
        return false;
    }

    return [
        'id' => (string) $user->id,
        'name' => $user->name ?: $user->email,
    ];
});

Broadcast::channel('review.media.{mediaUid}', function ($request, string $mediaUid) {
    $user = $request->attributes->get('archive_user');

    if (! $user instanceof User) {
        return false;
    }

    return [
        'id' => (string) $user->id,
        'name' => $user->name ?: $user->email,
    ];
});

// RT-801: same admin-or-creator rule as MediaJobsController::canAccess() —
// live progress for a job is exactly as visible as the job itself already is.
Broadcast::channel('media-job.{jobId}', function ($request, string $jobId) {
    $user = $request->attributes->get('archive_user');

    if (! $user instanceof User) {
        return false;
    }

    $mediaJob = MediaJob::query()->find($jobId);

    return $mediaJob !== null && $mediaJob->isAccessibleBy($user);
});

// RT-804: strictly the notification's own owner — never a shared/public
// channel, matching NotificationsController's existing per-user scoping.
Broadcast::channel('notifications.{userId}', function ($request, string $userId) {
    $user = $request->attributes->get('archive_user');

    return $user instanceof User && (string) $user->id === $userId;
});

// RT-802: aggregate queue counts only (no per-job data) — any authenticated
// user may subscribe, same as review.media/collaboration.room above.
Broadcast::channel('media-queue-status', function ($request) {
    return $request->attributes->get('archive_user') instanceof User;
});

// RT-804: edit-claim presence carries no data beyond who's editing which
// record, same "any authenticated archive user" gate as review.media above.
Broadcast::channel('record-edit.{recordId}', function ($request) {
    return $request->attributes->get('archive_user') instanceof User;
});
