<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ReviewComment;
use App\Models\ReviewLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReviewLinksApiTest extends TestCase
{
    use RefreshDatabase;

    private string $mediaUid = 'media-123';

    private function login(): string
    {
        User::query()->create([
            'name' => 'Test User',
            'email' => 'test@example.test',
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'test@example.test',
            'password' => 'password',
        ]);

        return $response->json('accessToken');
    }

    public function test_create_requires_auth(): void
    {
        $this->postJson("/api/v1/media/{$this->mediaUid}/review-links", [
            'permission' => 'comment',
        ])->assertUnauthorized();
    }

    public function test_create_persists_review_link_for_media_uid(): void
    {
        $accessToken = $this->login();

        $response = $this->postJson("/api/v1/media/{$this->mediaUid}/review-links", [
            'permission' => 'comment',
            'expiresAt' => now()->addDay()->toISOString(),
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('mediaUid', $this->mediaUid)
            ->assertJsonPath('permission', 'comment')
            ->assertJsonStructure(['token', 'url', 'path']);

        $token = $response->json('token');
        $this->assertIsString($token);
        $this->assertGreaterThanOrEqual(40, strlen($token));

        $this->assertDatabaseHas('review_links', [
            'token' => $token,
            'media_uid' => $this->mediaUid,
            'permission' => 'comment',
        ]);
    }

    public function test_public_read_returns_review_metadata_and_allowed_comments(): void
    {
        $accessToken = $this->login();

        ReviewComment::query()->create([
            'id' => 'comment-1',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 10.5,
            'author' => 'test@example.test',
            'body' => 'First review note',
            'resolved' => false,
        ]);

        ReviewComment::query()->create([
            'id' => 'comment-2',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 2.1,
            'author' => 'test@example.test',
            'body' => 'Second review note',
            'resolved' => false,
        ]);

        $response = $this->postJson("/api/v1/media/{$this->mediaUid}/review-links", [
            'permission' => 'comment',
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])->assertCreated();

        $this->getJson('/api/v1/review-links/'.$response->json('token'))
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('mediaUid', $this->mediaUid)
            ->assertJsonPath('review.permission', 'comment')
            ->assertJsonCount(2, 'comments')
            ->assertJsonPath('comments.0.timecodeSeconds', 2.1)
            ->assertJsonPath('comments.1.timecodeSeconds', 10.5)
            ->assertJsonMissingPath('token');
    }

    public function test_public_read_returns_existing_comments_when_permission_is_view(): void
    {
        $accessToken = $this->login();

        ReviewComment::query()->create([
            'id' => 'comment-1',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 5.0,
            'author' => 'test@example.test',
            'body' => 'Visible comment',
            'resolved' => false,
        ]);

        $response = $this->postJson("/api/v1/media/{$this->mediaUid}/review-links", [
            'permission' => 'view',
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])->assertCreated();

        $this->getJson('/api/v1/review-links/'.$response->json('token'))
            ->assertOk()
            ->assertJsonPath('review.permission', 'view')
            ->assertJsonCount(1, 'comments')
            ->assertJsonPath('comments.0.body', 'Visible comment');
    }

    public function test_public_read_hides_expired_review_links(): void
    {
        $accessToken = $this->login();

        $response = $this->postJson("/api/v1/media/{$this->mediaUid}/review-links", [
            'permission' => 'comment',
            'expiresAt' => now()->subMinute()->toISOString(),
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])->assertCreated();

        $this->getJson('/api/v1/review-links/'.$response->json('token'))
            ->assertNotFound()
            ->assertJsonPath('ok', false);

        $this->assertDatabaseHas('review_links', [
            'token' => $response->json('token'),
            'media_uid' => $this->mediaUid,
        ]);
    }
}
