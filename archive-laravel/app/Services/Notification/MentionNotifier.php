<?php

declare(strict_types=1);

namespace App\Services\Notification;

use App\Models\User;

/**
 * V1-721: detects "@Full Name" mentions in a note/comment body against the
 * current user directory and notifies each matched user (never the author).
 *
 * ponytail: matches on exact "@{$user->name}" substrings rather than a full
 * tokenizer — the mention picker (MentionTextarea on the frontend) always
 * inserts the exact stored name, so this is unambiguous for the common case.
 * Two users sharing an identical display name is a known, accepted gap for
 * this small-org tool; add per-user handles if that ever becomes real.
 */
class MentionNotifier
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function notify(string $body, User $author, string $recordId, string $store, string $context): void
    {
        if (! str_contains($body, '@')) {
            return;
        }

        $excerpt = mb_substr(trim($body), 0, 160);

        User::query()
            ->where('id', '!=', $author->id)
            ->get(['id', 'name'])
            ->each(function (User $candidate) use ($body, $author, $recordId, $store, $context, $excerpt): void {
                if ($candidate->name === '' || ! str_contains($body, '@'.$candidate->name)) {
                    return;
                }

                $this->notifications->createMentionNotification($candidate, $author, $context, $recordId, $store, $excerpt);
            });
    }
}
