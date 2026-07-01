<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ReviewComment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReviewCommentsApiTest extends TestCase
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

    public function test_list_returns_comments_ordered_by_timecode(): void
    {
        $accessToken = $this->login();

        ReviewComment::query()->create([
            'id' => 'comment-1',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 10.5,
            'author' => 'test@example.test',
            'body' => 'First comment',
            'resolved' => false,
        ]);

        ReviewComment::query()->create([
            'id' => 'comment-2',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 5.2,
            'author' => 'test@example.test',
            'body' => 'Second comment',
            'resolved' => false,
        ]);

        $this->getJson("/api/v1/media/{$this->mediaUid}/review-comments", [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('comments.0.timecodeSeconds', 5.2)
            ->assertJsonPath('comments.1.timecodeSeconds', 10.5);
    }

    public function test_list_returns_empty_array_when_no_comments(): void
    {
        $accessToken = $this->login();

        $this->getJson("/api/v1/media/{$this->mediaUid}/review-comments", [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('comments', []);
    }

    public function test_create_requires_auth(): void
    {
        $this->postJson("/api/v1/media/{$this->mediaUid}/review-comments", [
            'body' => 'Test comment',
            'timecodeSeconds' => 5.0,
        ])
            ->assertUnauthorized();
    }

    public function test_create_persists_comment_with_valid_input(): void
    {
        $accessToken = $this->login();

        $response = $this->postJson("/api/v1/media/{$this->mediaUid}/review-comments", [
            'body' => 'Test comment at 5 seconds',
            'timecodeSeconds' => 5.0,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('comment.mediaUid', $this->mediaUid)
            ->assertJsonPath('comment.body', 'Test comment at 5 seconds')
            ->assertJsonPath('comment.resolved', false);

        $this->assertEquals(5.0, $response->json('comment.timecodeSeconds'));

        $this->assertDatabaseHas('review_comments', [
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 5.0,
            'body' => 'Test comment at 5 seconds',
            'resolved' => false,
        ]);
    }

    public function test_create_rejects_empty_body(): void
    {
        $accessToken = $this->login();

        $this->postJson("/api/v1/media/{$this->mediaUid}/review-comments", [
            'body' => '',
            'timecodeSeconds' => 5.0,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertUnprocessable();
    }

    public function test_create_rejects_negative_timecode(): void
    {
        $accessToken = $this->login();

        $this->postJson("/api/v1/media/{$this->mediaUid}/review-comments", [
            'body' => 'Valid comment',
            'timecodeSeconds' => -1.0,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertUnprocessable();
    }

    public function test_update_requires_auth(): void
    {
        $comment = ReviewComment::query()->create([
            'id' => 'comment-1',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 5.0,
            'author' => 'test@example.test',
            'body' => 'Original',
            'resolved' => false,
        ]);

        $this->patchJson("/api/v1/review-comments/{$comment->id}", [
            'resolved' => true,
        ])
            ->assertUnauthorized();
    }

    public function test_update_toggles_resolved(): void
    {
        $accessToken = $this->login();

        $comment = ReviewComment::query()->create([
            'id' => 'comment-1',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 5.0,
            'author' => 'test@example.test',
            'body' => 'Original',
            'resolved' => false,
        ]);

        $this->patchJson("/api/v1/review-comments/{$comment->id}", [
            'resolved' => true,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('comment.resolved', true);

        $this->assertDatabaseHas('review_comments', [
            'id' => $comment->id,
            'resolved' => true,
        ]);
    }

    public function test_update_edits_body(): void
    {
        $accessToken = $this->login();

        $comment = ReviewComment::query()->create([
            'id' => 'comment-1',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 5.0,
            'author' => 'test@example.test',
            'body' => 'Original body',
            'resolved' => false,
        ]);

        $this->patchJson("/api/v1/review-comments/{$comment->id}", [
            'body' => 'Updated body',
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('comment.body', 'Updated body');

        $this->assertDatabaseHas('review_comments', [
            'id' => $comment->id,
            'body' => 'Updated body',
        ]);
    }

    public function test_update_partial_fields(): void
    {
        $accessToken = $this->login();

        $comment = ReviewComment::query()->create([
            'id' => 'comment-1',
            'media_uid' => $this->mediaUid,
            'timecode_seconds' => 5.0,
            'author' => 'test@example.test',
            'body' => 'Original',
            'resolved' => false,
        ]);

        $this->patchJson("/api/v1/review-comments/{$comment->id}", [
            'resolved' => true,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertOk();

        $this->assertDatabaseHas('review_comments', [
            'id' => $comment->id,
            'body' => 'Original',
            'resolved' => true,
        ]);
    }

    public function test_create_persists_and_returns_annotation_rectangles(): void
    {
        $accessToken = $this->login();

        $annotation = [
            ['x' => 0.1, 'y' => 0.2, 'w' => 0.3, 'h' => 0.25],
            ['x' => 0.5, 'y' => 0.5, 'w' => 0.2, 'h' => 0.2],
        ];

        $this->postJson("/api/v1/media/{$this->mediaUid}/review-comments", [
            'body' => 'Comment with annotation',
            'timecodeSeconds' => 3.0,
            'annotation' => $annotation,
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertCreated()
            ->assertJsonPath('comment.annotation.0.x', 0.1)
            ->assertJsonPath('comment.annotation.1.w', 0.2);
    }

    public function test_create_rejects_out_of_range_annotation(): void
    {
        $accessToken = $this->login();

        $this->postJson("/api/v1/media/{$this->mediaUid}/review-comments", [
            'body' => 'Bad annotation',
            'timecodeSeconds' => 1.0,
            'annotation' => [['x' => 1.5, 'y' => 0.2, 'w' => 0.3, 'h' => 0.3]],
        ], [
            'Authorization' => 'Bearer '.$accessToken,
        ])
            ->assertUnprocessable();
    }
}
