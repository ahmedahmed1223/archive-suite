<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V3-MEDIA-004: non-destructive clip lists tied to a record + version.
 * Version identity reuses ReviewSessionService::resolveVersionToken (see
 * ReviewSessionsApiTest for the equivalent coverage on that side).
 */
class MediaClipsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_creates_a_clip_pinned_to_the_record_source_version(): void
    {
        $this->seedRecord('record-1', 'checksum-1');

        $created = $this->postJson('/api/v1/records/record-1/clips', [
            'title' => 'Opening shot',
            'notes' => 'Keep for trailer',
            'inSeconds' => 1.5,
            'outSeconds' => 4.25,
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('clip.recordUid', 'record-1')
            ->assertJsonPath('clip.attachmentId', null)
            ->assertJsonPath('clip.versionToken', 'record:checksum-1')
            ->assertJsonPath('clip.isCurrentVersion', true)
            ->assertJsonPath('clip.title', 'Opening shot')
            ->assertJsonPath('clip.inSeconds', 1.5)
            ->assertJsonPath('clip.outSeconds', 4.25)
            ->assertJsonPath('clip.fps', 25);

        $this->assertIsString($created->json('clip.id'));
    }

    public function test_rejects_a_clip_where_out_is_before_in(): void
    {
        $this->seedRecord('record-2', 'checksum-2');

        $this->postJson('/api/v1/records/record-2/clips', [
            'title' => 'Bad range',
            'inSeconds' => 10,
            'outSeconds' => 4,
        ], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonValidationErrors(['outSeconds']);

        $this->postJson('/api/v1/records/record-2/clips', [
            'title' => 'Equal range',
            'inSeconds' => 5,
            'outSeconds' => 5,
        ], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonValidationErrors(['outSeconds']);

        $this->assertSame(0, DB::table('media_clips')->count());
    }

    public function test_update_rejects_out_before_in_and_allows_partial_field_updates(): void
    {
        $this->seedRecord('record-3', 'checksum-3');
        $id = $this->createClip('record-3', ['inSeconds' => 2, 'outSeconds' => 8]);

        // Title-only update never touches the stored range, so no time
        // fields are required.
        $this->patchJson("/api/v1/clips/{$id}", ['title' => 'Renamed'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('clip.title', 'Renamed')
            ->assertJsonPath('clip.inSeconds', 2)
            ->assertJsonPath('clip.outSeconds', 8);

        // A partial time update must supply both ends together.
        $this->patchJson("/api/v1/clips/{$id}", ['inSeconds' => 3], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonValidationErrors(['outSeconds']);

        $this->patchJson("/api/v1/clips/{$id}", ['inSeconds' => 6, 'outSeconds' => 3], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonValidationErrors(['outSeconds']);

        $this->patchJson("/api/v1/clips/{$id}", ['inSeconds' => 6, 'outSeconds' => 12], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('clip.inSeconds', 6)
            ->assertJsonPath('clip.outSeconds', 12);
    }

    public function test_attachment_scoped_clip_tracks_the_attachment_checksum(): void
    {
        Storage::fake(config('ingest.disk'));
        $this->seedRecord('record-4', 'record-checksum');

        $upload = $this->post('/api/v1/records/record-4/attachments', [
            'store' => 'archive-items',
            'files' => [UploadedFile::fake()->createWithContent('cut-b.txt', 'attachment-body')],
        ], $this->authHeaders())->assertCreated();
        $attachmentId = $upload->json('attachments.0.id');
        $expectedChecksum = hash('sha256', 'attachment-body');

        $clip = $this->postJson('/api/v1/records/record-4/clips', [
            'attachmentId' => $attachmentId,
            'title' => 'Version B clip',
            'inSeconds' => 0,
            'outSeconds' => 1,
        ], $this->authHeaders())->assertCreated();

        $clip->assertJsonPath('clip.attachmentId', $attachmentId)
            ->assertJsonPath('clip.versionToken', 'attachment:'.$expectedChecksum);
    }

    public function test_replacing_the_source_marks_existing_clips_as_stale_but_keeps_them(): void
    {
        $disk = config('ingest.disk');
        Storage::fake($disk);
        Storage::disk($disk)->put('ingest/uploads/original.txt', 'original');
        $this->seedRecord('record-5', hash('sha256', 'original'), 'ingest/uploads/original.txt', 'original.txt');

        $id = $this->createClip('record-5', ['inSeconds' => 0, 'outSeconds' => 2]);

        $this->post('/api/v1/records/record-5/source-replacements', [
            'file' => UploadedFile::fake()->createWithContent('replacement.txt', 'replacement'),
        ], $this->authHeaders())->assertOk();

        $stale = $this->getJson("/api/v1/clips/{$id}", $this->authHeaders())->assertOk();
        $this->assertFalse($stale->json('clip.isCurrentVersion'));
        // Original media file is untouched -- the clip is just metadata.
        $this->assertTrue(Storage::disk($disk)->exists('ingest/uploads/original.txt'));
    }

    public function test_viewer_cannot_create_update_or_delete_clips(): void
    {
        $this->seedRecord('record-6', 'checksum-6');
        $id = $this->createClip('record-6', ['inSeconds' => 0, 'outSeconds' => 1]);
        $viewer = $this->viewerHeaders();

        $this->postJson('/api/v1/records/record-6/clips', [
            'title' => 'x', 'inSeconds' => 0, 'outSeconds' => 1,
        ], $viewer)->assertForbidden();

        $this->patchJson("/api/v1/clips/{$id}", ['title' => 'y'], $viewer)->assertForbidden();
        $this->deleteJson("/api/v1/clips/{$id}", [], $viewer)->assertForbidden();

        $this->assertDatabaseHas('media_clips', ['id' => $id, 'title' => 'Fixture clip']);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->seedRecord('record-7', 'checksum-7');

        $this->postJson('/api/v1/records/record-7/clips', ['title' => 'x', 'inSeconds' => 0, 'outSeconds' => 1])
            ->assertUnauthorized();
        $this->getJson('/api/v1/records/record-7/clips')->assertUnauthorized();
    }

    public function test_missing_record_returns_not_found_on_create(): void
    {
        $this->postJson('/api/v1/records/missing-record/clips', [
            'title' => 'x', 'inSeconds' => 0, 'outSeconds' => 1,
        ], $this->authHeaders())->assertNotFound();
    }

    public function test_missing_clip_returns_not_found(): void
    {
        $this->getJson('/api/v1/clips/does-not-exist', $this->authHeaders())->assertNotFound();
        $this->patchJson('/api/v1/clips/does-not-exist', ['title' => 'x'], $this->authHeaders())->assertNotFound();
        $this->deleteJson('/api/v1/clips/does-not-exist', [], $this->authHeaders())->assertNotFound();
    }

    public function test_index_and_delete(): void
    {
        $this->seedRecord('record-8', 'checksum-8');
        $this->createClip('record-8', ['inSeconds' => 0, 'outSeconds' => 1]);
        $id = $this->createClip('record-8', ['inSeconds' => 5, 'outSeconds' => 6]);

        $this->getJson('/api/v1/records/record-8/clips', $this->authHeaders())
            ->assertOk()->assertJsonCount(2, 'clips');

        $this->deleteJson("/api/v1/clips/{$id}", [], $this->authHeaders())
            ->assertOk()->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/records/record-8/clips', $this->authHeaders())
            ->assertOk()->assertJsonCount(1, 'clips');
    }

    public function test_export_json_embeds_version_and_frame_rate_identity(): void
    {
        $this->seedRecord('record-9', 'checksum-9');
        $this->createClip('record-9', ['inSeconds' => 0, 'outSeconds' => 2, 'fps' => 30]);

        $response = $this->getJson('/api/v1/records/record-9/clips/export?format=json', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('recordUid', 'record-9')
            ->assertJsonCount(1, 'clips');

        $clip = $response->json('clips.0');
        $this->assertSame('record:checksum-9', $clip['versionToken']);
        $this->assertSame(30, $clip['fps']);
        $this->assertNull($clip['attachmentId']);
        $this->assertSame('archive-items', $clip['recordStore']);
    }

    public function test_export_csv_streams_a_downloadable_file_with_identity_columns(): void
    {
        $this->seedRecord('record-10', 'checksum-10');
        $this->createClip('record-10', ['inSeconds' => 1, 'outSeconds' => 3, 'title' => 'CSV clip', 'fps' => 24]);

        $response = $this->get('/api/v1/records/record-10/clips/export?format=csv', $this->authHeaders());

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('attachment; filename="clip-list-record-10.csv"', $response->headers->get('content-disposition'));

        $body = $response->getContent();
        $this->assertStringContainsString('id,title,notes,inSeconds,outSeconds,fps,recordStore,recordUid,attachmentId,versionToken,isCurrentVersion,createdAt', $body);
        $this->assertStringContainsString('CSV clip', $body);
        $this->assertStringContainsString('record:checksum-10', $body);
        $this->assertStringContainsString(',24,', $body);
    }

    public function test_export_rejects_unknown_format(): void
    {
        $this->seedRecord('record-11', 'checksum-11');

        $this->getJson('/api/v1/records/record-11/clips/export?format=xml', $this->authHeaders())
            ->assertStatus(422);
    }

    public function test_it_audits_clip_create_update_and_delete(): void
    {
        $this->seedRecord('record-12', 'checksum-12');
        $id = $this->createClip('record-12', ['inSeconds' => 0, 'outSeconds' => 1]);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'media_clips.create',
            'resource_type' => 'media_clip',
            'resource_id' => 'record-12',
        ]);

        $this->patchJson("/api/v1/clips/{$id}", ['title' => 'Audited'], $this->authHeaders())->assertOk();
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'media_clips.update',
            'resource_type' => 'media_clip',
            'resource_id' => $id,
            'outcome' => 'success',
        ]);

        $this->deleteJson("/api/v1/clips/{$id}", [], $this->authHeaders())->assertOk();
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'media_clips.delete',
            'resource_type' => 'media_clip',
            'resource_id' => $id,
            'outcome' => 'success',
        ]);
    }

    private function seedRecord(string $uid, string $checksum, ?string $filePath = null, ?string $fileName = null): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode([
                'id' => $uid,
                'title' => 'Clip list fixture',
                'checksum' => $checksum,
                'filePath' => $filePath,
                'fileName' => $fileName,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createClip(string $recordId, array $overrides = []): string
    {
        $payload = array_merge([
            'title' => 'Fixture clip',
            'inSeconds' => 0,
            'outSeconds' => 1,
        ], $overrides);

        $id = $this->postJson("/api/v1/records/{$recordId}/clips", $payload, $this->authHeaders())
            ->assertCreated()
            ->json('clip.id');
        $this->assertIsString($id);

        return $id;
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Clip Viewer',
            'email' => 'clip-viewer@example.test',
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
