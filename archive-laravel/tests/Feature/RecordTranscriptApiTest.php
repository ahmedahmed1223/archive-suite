<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class RecordTranscriptApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_updates_only_the_transcript_for_a_matching_record(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [[
                'uid' => 'media-001',
                'id' => 'legacy-media-id',
                'title' => 'Interview',
                'tags' => ['oral-history'],
                'metadata' => ['source' => 'tape'],
                'transcript' => 'old transcript',
            ]],
        ], $this->authHeaders())->assertOk();

        $this->patchJson('/api/v1/records/legacy-media-id/transcript', [
            'store' => 'archive-items',
            'transcript' => "WEBVTT\n\n00:00.000 --> 00:02.000\nHello",
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('record.uid', 'media-001')
            ->assertJsonPath('record.id', 'legacy-media-id')
            ->assertJsonPath('record.transcript', "WEBVTT\n\n00:00.000 --> 00:02.000\nHello")
            ->assertJsonPath('record.title', 'Interview')
            ->assertJsonPath('record.tags', ['oral-history'])
            ->assertJsonPath('record.metadata.source', 'tape');
    }

    public function test_it_returns_not_found_for_an_unknown_record(): void
    {
        $this->patchJson('/api/v1/records/missing/transcript', [
            'store' => 'archive-items',
            'transcript' => 'WEBVTT',
        ], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_denies_viewers_from_updating_transcripts(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'media-002', 'title' => 'Restricted']],
        ], $this->authHeaders())->assertOk();

        $this->patchJson('/api/v1/records/media-002/transcript', [
            'store' => 'archive-items',
            'transcript' => 'WEBVTT',
        ], $this->viewerHeaders())
            ->assertForbidden()
            ->assertJsonPath('ok', false);
    }

    public function test_it_rejects_blank_or_oversized_transcripts(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'media-003', 'title' => 'Validation']],
        ], $this->authHeaders())->assertOk();

        foreach (['   ', str_repeat('x', 1_000_001)] as $transcript) {
            $this->patchJson('/api/v1/records/media-003/transcript', [
                'store' => 'archive-items',
                'transcript' => $transcript,
            ], $this->authHeaders())
                ->assertUnprocessable()
                ->assertJsonValidationErrors('transcript');
        }
    }

    /** @return array<string, string> */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Transcript Viewer',
            'email' => 'transcript-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $viewer->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->assertIsString($token);

        return ['Authorization' => 'Bearer '.$token];
    }
}
