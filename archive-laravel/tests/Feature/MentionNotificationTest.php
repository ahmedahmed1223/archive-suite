<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * V1-721: @-mentioning a teammate by their exact display name in a record
 * note or comment creates a 'mention' Notification for them.
 */
class MentionNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function seedArchiveRecord(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'item-mentions-1',
            'data' => json_encode([
                'uid' => 'item-mentions-1',
                'id' => 'item-mentions-1',
                'title' => 'Record for mention tests',
                'type' => 'video',
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /** @return array<string, string> */
    private function headersFor(string $role, string $name, string $email): array
    {
        User::query()->create(['name' => $name, 'email' => $email, 'password' => Hash::make('secret-password'), 'role' => $role]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'secret-password'])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }

    public function test_mentioning_a_teammate_in_a_note_notifies_them(): void
    {
        $this->seedArchiveRecord();
        $author = $this->headersFor('editor', 'محرر أحمد', 'author-note@example.test');
        $mentioned = User::query()->create(['name' => 'سارة المحررة', 'email' => 'mentioned-note@example.test', 'password' => Hash::make('secret-password'), 'role' => 'editor']);

        $this->postJson('/api/v1/records/item-mentions-1/notes', [
            'body' => 'مرحباً @سارة المحررة راجعي هذا السجل من فضلك.',
        ], $author)->assertCreated();

        $notification = Notification::query()->where('user_id', $mentioned->id)->where('type', 'mention')->first();
        $this->assertNotNull($notification);
        $this->assertSame('note', $notification->metadata['context']);
        $this->assertSame('item-mentions-1', $notification->metadata['recordId']);
        $this->assertSame('محرر أحمد', $notification->metadata['authorName']);
    }

    public function test_mentioning_a_teammate_in_a_comment_notifies_them(): void
    {
        $this->seedArchiveRecord();
        $author = $this->headersFor('editor', 'كاتب التعليق', 'author-comment@example.test');
        $mentioned = User::query()->create(['name' => 'مراجع التعليق', 'email' => 'mentioned-comment@example.test', 'password' => Hash::make('secret-password'), 'role' => 'viewer']);

        $this->postJson('/api/v1/records/item-mentions-1/comments', [
            'body' => 'انتبه @مراجع التعليق لهذا التغيير.',
        ], $author)->assertCreated();

        $notification = Notification::query()->where('user_id', $mentioned->id)->where('type', 'mention')->first();
        $this->assertNotNull($notification);
        $this->assertSame('comment', $notification->metadata['context']);
    }

    public function test_mentioning_yourself_does_not_notify(): void
    {
        $this->seedArchiveRecord();
        $author = $this->headersFor('editor', 'ذاتي المرجع', 'self-mention@example.test');

        $this->postJson('/api/v1/records/item-mentions-1/notes', [
            'body' => 'ملاحظة من @ذاتي المرجع لنفسي.',
        ], $author)->assertCreated();

        $this->assertSame(0, Notification::query()->where('type', 'mention')->count());
    }

    public function test_a_name_that_does_not_match_any_user_notifies_no_one(): void
    {
        $this->seedArchiveRecord();
        $author = $this->headersFor('editor', 'كاتب بلا إشارة', 'no-mention@example.test');

        $this->postJson('/api/v1/records/item-mentions-1/notes', [
            'body' => 'لا يوجد هنا @شخص_غير_موجود على الإطلاق.',
        ], $author)->assertCreated();

        $this->assertSame(0, Notification::query()->where('type', 'mention')->count());
    }

    public function test_mentionable_users_endpoint_is_open_to_viewers_and_hides_email_and_role(): void
    {
        User::query()->create(['name' => 'ضيف القائمة', 'email' => 'listed@example.test', 'password' => Hash::make('secret-password'), 'role' => 'admin']);
        $viewer = $this->headersFor('viewer', 'مشاهد بسيط', 'viewer-mentionable@example.test');

        $response = $this->getJson('/api/v1/users/mentionable', $viewer)->assertOk();
        $response->assertJsonPath('ok', true);
        $names = collect($response->json('users'))->pluck('name');
        $this->assertTrue($names->contains('ضيف القائمة'));
        $this->assertTrue($names->contains('مشاهد بسيط'));
        $this->assertArrayNotHasKey('email', $response->json('users')[0]);
        $this->assertArrayNotHasKey('role', $response->json('users')[0]);
    }

    public function test_mentionable_users_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/v1/users/mentionable')->assertUnauthorized();
    }
}
