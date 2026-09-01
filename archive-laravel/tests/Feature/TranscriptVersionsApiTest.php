<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class TranscriptVersionsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_saving_a_cue_list_creates_a_version_and_mirrors_the_legacy_transcript_fields(): void
    {
        $this->seedRecord('clip-1');

        $cues = [
            ['startSeconds' => 0.0, 'endSeconds' => 2.0, 'text' => 'أهلاً وسهلاً'],
            ['startSeconds' => 2.0, 'endSeconds' => 4.5, 'text' => 'بكم في الأرشيف'],
        ];

        $response = $this->postJson('/api/v1/records/clip-1/transcript/versions', [
            'format' => 'srt',
            'cues' => $cues,
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('version.locked', false)
            ->assertJsonPath('version.cues.0.text', 'أهلاً وسهلاً');

        $versionId = $response->json('version.id');
        $this->assertIsString($versionId);

        $record = DB::table('storage_rows')->where(['store' => 'archive-items', 'uid' => 'clip-1'])->first();
        $data = json_decode($record->data, true);
        $this->assertSame("أهلاً وسهلاً\nبكم في الأرشيف", $data['transcript']);
        $this->assertSame('srt', $data['transcriptFormat']);
    }

    public function test_out_of_order_cues_are_rejected(): void
    {
        $this->seedRecord('clip-2');

        $this->postJson('/api/v1/records/clip-2/transcript/versions', [
            'format' => 'srt',
            'cues' => [
                ['startSeconds' => 5.0, 'endSeconds' => 6.0, 'text' => 'second'],
                ['startSeconds' => 1.0, 'endSeconds' => 2.0, 'text' => 'first'],
            ],
        ], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_FAILED');
    }

    public function test_overlapping_cues_are_rejected(): void
    {
        $this->seedRecord('clip-3');

        $this->postJson('/api/v1/records/clip-3/transcript/versions', [
            'format' => 'srt',
            'cues' => [
                ['startSeconds' => 0.0, 'endSeconds' => 3.0, 'text' => 'first'],
                ['startSeconds' => 2.0, 'endSeconds' => 5.0, 'text' => 'overlaps the first cue'],
            ],
        ], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('code', 'VALIDATION_FAILED');
    }

    public function test_locking_a_transcript_blocks_further_saves_until_explicitly_unlocked(): void
    {
        $this->seedRecord('clip-4');
        $this->saveVersion('clip-4', [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'v1']]);

        $this->postJson('/api/v1/records/clip-4/transcript/lock', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('version.locked', true);

        // Silent overwrite attempt: no unlock flag.
        $this->postJson('/api/v1/records/clip-4/transcript/versions', [
            'format' => 'srt',
            'cues' => [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'v2']],
        ], $this->authHeaders())
            ->assertStatus(409)
            ->assertJsonPath('code', 'CONFLICT');

        // Explicit unlock flag lets the edit through and starts a fresh,
        // unlocked version.
        $unlocked = $this->postJson('/api/v1/records/clip-4/transcript/versions', [
            'format' => 'srt',
            'unlock' => true,
            'cues' => [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'v2']],
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('version.locked', false);

        $this->assertNotNull($unlocked);
    }

    public function test_restoring_an_earlier_version_creates_a_new_version_and_is_audited(): void
    {
        $this->seedRecord('clip-5');
        $v1 = $this->saveVersion('clip-5', [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'original']]);
        $this->saveVersion('clip-5', [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'edited']]);

        $restored = $this->postJson("/api/v1/records/clip-5/transcript/versions/{$v1}/restore", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('version.cues.0.text', 'original')
            ->assertJsonPath('version.restoredFromVersionId', $v1);

        $this->assertNotSame($v1, $restored->json('version.id'));

        $history = $this->getJson('/api/v1/records/clip-5/transcript/versions', $this->authHeaders())->assertOk();
        $this->assertCount(3, $history->json('versions'));

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'transcript_versions.restore',
            'resource_type' => 'transcript_version',
            'resource_id' => 'clip-5',
            'outcome' => 'success',
        ]);
    }

    public function test_restoring_over_a_locked_transcript_requires_explicit_unlock(): void
    {
        $this->seedRecord('clip-6');
        $v1 = $this->saveVersion('clip-6', [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'v1']]);
        $this->saveVersion('clip-6', [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'v2']]);
        $this->postJson('/api/v1/records/clip-6/transcript/lock', [], $this->authHeaders())->assertOk();

        $this->postJson("/api/v1/records/clip-6/transcript/versions/{$v1}/restore", [], $this->authHeaders())
            ->assertStatus(409);

        $this->postJson("/api/v1/records/clip-6/transcript/versions/{$v1}/restore", [
            'unlock' => true,
        ], $this->authHeaders())->assertOk();
    }

    public function test_export_returns_srt_and_vtt_with_arabic_text_preserved(): void
    {
        $this->seedRecord('clip-7');
        $this->saveVersion('clip-7', [
            ['startSeconds' => 1.5, 'endSeconds' => 3.25, 'text' => 'مرحبا بالعالم'],
        ]);

        $srt = $this->get('/api/v1/records/clip-7/transcript/export/srt', $this->authHeaders());
        $srt->assertOk();
        $this->assertStringContainsString('مرحبا بالعالم', $srt->getContent());
        $this->assertStringContainsString('00:00:01,500 --> 00:00:03,250', $srt->getContent());

        $vtt = $this->get('/api/v1/records/clip-7/transcript/export/vtt', $this->authHeaders());
        $vtt->assertOk();
        $this->assertStringContainsString('WEBVTT', $vtt->getContent());
        $this->assertStringContainsString('مرحبا بالعالم', $vtt->getContent());
        $this->assertStringContainsString('00:00:01.500 --> 00:00:03.250', $vtt->getContent());
    }

    public function test_viewer_cannot_save_lock_or_restore_transcript_versions(): void
    {
        $this->seedRecord('clip-8');
        $v1 = $this->saveVersion('clip-8', [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'v1']]);

        $viewer = $this->viewerHeaders();

        $this->postJson('/api/v1/records/clip-8/transcript/versions', [
            'format' => 'srt',
            'cues' => [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'v2']],
        ], $viewer)->assertForbidden();

        $this->postJson('/api/v1/records/clip-8/transcript/lock', [], $viewer)->assertForbidden();
        $this->postJson("/api/v1/records/clip-8/transcript/versions/{$v1}/restore", [], $viewer)->assertForbidden();
    }

    public function test_missing_record_returns_not_found(): void
    {
        $this->getJson('/api/v1/records/missing/transcript/versions', $this->authHeaders())->assertNotFound();
        $this->postJson('/api/v1/records/missing/transcript/versions', [
            'format' => 'srt',
            'cues' => [['startSeconds' => 0.0, 'endSeconds' => 1.0, 'text' => 'x']],
        ], $this->authHeaders())->assertNotFound();
    }

    private function seedRecord(string $uid): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode(['id' => $uid, 'title' => 'Transcript fixture'], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<int, array{startSeconds: float, endSeconds: float, text: string}>  $cues
     */
    private function saveVersion(string $recordId, array $cues): string
    {
        $response = $this->postJson("/api/v1/records/{$recordId}/transcript/versions", [
            'format' => 'srt',
            'unlock' => true,
            'cues' => $cues,
        ], $this->authHeaders())->assertCreated();

        $id = $response->json('version.id');
        $this->assertIsString($id);

        return $id;
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Transcript Viewer',
            'email' => 'transcript-versions-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $viewer->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }
}
