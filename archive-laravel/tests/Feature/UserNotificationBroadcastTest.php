<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Events\UserNotificationCreated;
use App\Models\User;
use App\Services\Notification\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * RT-804: every NotificationService::create*() call broadcasts
 * UserNotificationCreated on the notification owner's own private channel —
 * never a shared one. The routes/channels.php gate for
 * notifications.{userId} is a trivial one-line owner-id comparison, not
 * tested separately (see MediaJobProgressBroadcastTest for the pattern this
 * follows when a gate has real logic worth isolating).
 */
class UserNotificationBroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_a_notification_broadcasts_it_on_the_owners_channel(): void
    {
        Event::fake([UserNotificationCreated::class]);

        $user = User::factory()->create();
        $notification = app(NotificationService::class)->createIngestNotification($user, 5, 1);

        Event::assertDispatched(UserNotificationCreated::class, function (UserNotificationCreated $event) use ($user, $notification): bool {
            return $event->userId === (string) $user->id
                && $event->notification['id'] === $notification->id
                && in_array('private-notifications.'.$user->id, array_map(
                    fn ($channel) => $channel->name,
                    $event->broadcastOn()
                ), true);
        });
    }
}
