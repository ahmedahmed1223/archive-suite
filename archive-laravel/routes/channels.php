<?php

declare(strict_types=1);

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
