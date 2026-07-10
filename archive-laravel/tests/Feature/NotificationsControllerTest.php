<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationsControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_can_list_notifications_with_pagination(): void
    {
        Notification::factory(25)->for($this->user)->create();

        $response = $this->actingAs($this->user)->getJson('/api/v1/notifications?page=1&limit=10');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'ok',
            'notifications' => [
                '*' => ['id', 'user_id', 'type', 'title', 'message', 'is_read', 'created_at', 'updated_at']
            ],
            'pagination' => ['total', 'page', 'limit', 'hasMore']
        ]);
        $this->assertCount(10, $response->json('notifications'));
        $this->assertEquals(25, $response->json('pagination.total'));
        $this->assertTrue($response->json('pagination.hasMore'));
    }

    public function test_can_view_single_notification(): void
    {
        $notification = Notification::factory()->for($this->user)->create([
            'title' => 'Test Notification',
            'message' => 'This is a test',
        ]);

        $response = $this->actingAs($this->user)->getJson("/api/v1/notifications/{$notification->id}");

        $response->assertStatus(200);
        $response->assertJson([
            'ok' => true,
            'notification' => [
                'id' => $notification->id,
                'title' => 'Test Notification',
                'message' => 'This is a test',
            ]
        ]);
    }

    public function test_cannot_view_other_users_notification(): void
    {
        $otherUser = User::factory()->create();
        $notification = Notification::factory()->for($otherUser)->create();

        $response = $this->actingAs($this->user)->getJson("/api/v1/notifications/{$notification->id}");

        $response->assertStatus(404);
    }

    public function test_can_mark_notification_as_read(): void
    {
        $notification = Notification::factory()->for($this->user)->create(['is_read' => false]);

        $response = $this->actingAs($this->user)->postJson("/api/v1/notifications/{$notification->id}/read");

        $response->assertStatus(200);
        $this->assertTrue($response->json('notification.is_read'));
        $this->assertTrue($notification->fresh()->is_read);
    }

    public function test_can_mark_notification_as_unread(): void
    {
        $notification = Notification::factory()->for($this->user)->create(['is_read' => true]);

        $response = $this->actingAs($this->user)->postJson("/api/v1/notifications/{$notification->id}/unread");

        $response->assertStatus(200);
        $this->assertFalse($response->json('notification.is_read'));
        $this->assertFalse($notification->fresh()->is_read);
    }

    public function test_can_mark_all_notifications_as_read(): void
    {
        Notification::factory(5)->for($this->user)->create(['is_read' => false]);

        $response = $this->actingAs($this->user)->postJson('/api/v1/notifications/mark-all-read');

        $response->assertStatus(200);
        $this->assertEquals(0, $this->user->notifications()->where('is_read', false)->count());
    }

    public function test_can_delete_notification(): void
    {
        $notification = Notification::factory()->for($this->user)->create();

        $response = $this->actingAs($this->user)->deleteJson("/api/v1/notifications/{$notification->id}");

        $response->assertStatus(200);
        $this->assertNull(Notification::find($notification->id));
    }

    public function test_cannot_delete_other_users_notification(): void
    {
        $otherUser = User::factory()->create();
        $notification = Notification::factory()->for($otherUser)->create();

        $response = $this->actingAs($this->user)->deleteJson("/api/v1/notifications/{$notification->id}");

        $response->assertStatus(404);
        $this->assertNotNull(Notification::find($notification->id));
    }

    public function test_only_own_notifications_appear_in_list(): void
    {
        $otherUser = User::factory()->create();
        Notification::factory(5)->for($this->user)->create();
        Notification::factory(5)->for($otherUser)->create();

        $response = $this->actingAs($this->user)->getJson('/api/v1/notifications');

        $response->assertStatus(200);
        $this->assertCount(5, $response->json('notifications'));
        $this->assertEquals(5, $response->json('pagination.total'));
    }

    public function test_notifications_are_ordered_by_newest_first(): void
    {
        $n1 = Notification::factory()->for($this->user)->create();
        sleep(1);
        $n2 = Notification::factory()->for($this->user)->create();
        sleep(1);
        $n3 = Notification::factory()->for($this->user)->create();

        $response = $this->actingAs($this->user)->getJson('/api/v1/notifications');

        $notifications = $response->json('notifications');
        $this->assertEquals($n3->id, $notifications[0]['id']);
        $this->assertEquals($n2->id, $notifications[1]['id']);
        $this->assertEquals($n1->id, $notifications[2]['id']);
    }

    public function test_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/notifications');
        $response->assertStatus(401);
    }
}
