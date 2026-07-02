<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Events\CollaborationDocumentUpdated;
use App\Models\CollaborationDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CollaborationDocumentsApiTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $email, string $name): string
    {
        User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password',
        ])->assertOk();

        $token = $response->json('accessToken');
        $this->assertIsString($token);

        return $token;
    }

    public function test_documents_require_authentication(): void
    {
        $this->getJson('/api/v1/collaboration/rooms/review-1/documents/record-1')->assertUnauthorized();
        $this->postJson('/api/v1/collaboration/rooms/review-1/documents/record-1', [
            'content' => 'Draft',
            'version' => 0,
        ])->assertUnauthorized();
    }

    public function test_document_get_returns_empty_document_when_missing(): void
    {
        $accessToken = $this->login('editor@example.test', 'Archive Editor');

        $this->getJson('/api/v1/collaboration/rooms/review-1/documents/record-1', [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('document.resourceId', 'record-1')
            ->assertJsonPath('document.content', '')
            ->assertJsonPath('document.version', 0);
    }

    public function test_user_can_update_document_with_current_version(): void
    {
        Event::fake([CollaborationDocumentUpdated::class]);
        $accessToken = $this->login('editor@example.test', 'Archive Editor');

        $this->postJson('/api/v1/collaboration/rooms/review-1/documents/record-1', [
            'content' => 'Shared draft',
            'version' => 0,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('document.content', 'Shared draft')
            ->assertJsonPath('document.version', 1)
            ->assertJsonPath('document.updatedByDisplayName', 'Archive Editor');

        $this->assertDatabaseHas('collaboration_documents', [
            'room_key' => 'review-1',
            'resource_id' => 'record-1',
            'version' => 1,
        ]);

        $this->postJson('/api/v1/collaboration/rooms/review-1/documents/record-1', [
            'content' => '',
            'version' => 1,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('document.content', '')
            ->assertJsonPath('document.version', 2);

        Event::assertDispatched(CollaborationDocumentUpdated::class, function (CollaborationDocumentUpdated $event): bool {
            return $event->roomKey === 'review-1'
                && $event->document['resourceId'] === 'record-1'
                && in_array($event->document['version'], [1, 2], true);
        });
    }

    public function test_stale_document_update_returns_conflict_with_current_document(): void
    {
        $accessToken = $this->login('editor@example.test', 'Archive Editor');

        CollaborationDocument::query()->create([
            'id' => '11111111-1111-1111-1111-111111111111',
            'room_key' => 'review-1',
            'resource_id' => 'record-1',
            'content' => 'Current',
            'version' => 3,
            'updated_by_display_name' => 'Other Editor',
        ]);

        $this->postJson('/api/v1/collaboration/rooms/review-1/documents/record-1', [
            'content' => 'Stale',
            'version' => 2,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertStatus(409)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'document_version_conflict')
            ->assertJsonPath('document.content', 'Current')
            ->assertJsonPath('document.version', 3);
    }

    public function test_document_update_respects_another_users_lock(): void
    {
        $firstToken = $this->login('first@example.test', 'First Editor');
        $secondToken = $this->login('second@example.test', 'Second Editor');

        $this->postJson('/api/v1/collaboration/rooms/review-1/locks', [
            'resourceId' => 'record-1',
        ], [
            'Authorization' => 'Bearer '.$firstToken,
        ])->assertCreated();

        $this->postJson('/api/v1/collaboration/rooms/review-1/documents/record-1', [
            'content' => 'Second write',
            'version' => 0,
        ], [
            'Authorization' => 'Bearer '.$secondToken,
        ])
            ->assertStatus(409)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'lock_conflict')
            ->assertJsonPath('lock.displayName', 'First Editor');
    }
}
