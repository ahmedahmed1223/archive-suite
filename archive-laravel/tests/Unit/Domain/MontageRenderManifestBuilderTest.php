<?php

namespace Tests\Unit\Domain;

use App\Domain\Montage\MontageRenderManifestBuilder;
use App\Domain\Montage\MontageValidationException;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class MontageRenderManifestBuilderTest extends TestCase
{
    use RefreshDatabase;

    private MontageRenderManifestBuilder $builder;
    private User $actor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->builder = app(MontageRenderManifestBuilder::class);
        $this->actor = User::factory()->create(['role' => 'editor']);
    }

    public function test_archive_master_resolves_a_pinned_primary_record_from_server_storage(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('media/source.mov', 'trusted-source');
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'record-archive-master',
            'data' => json_encode([
                'fileName' => 'source.mov',
                'filePath' => 'media/source.mov',
                'checksum' => 'primary-checksum',
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $actor = User::factory()->create(['role' => 'editor']);

        $manifest = $this->builder->build(
            preset: 'archive-master',
            revisionId: (string) Str::uuid(),
            clips: [[
                'id' => (string) Str::uuid(),
                'source' => [
                    'recordId' => 'record-archive-master',
                    'sourceVersionToken' => 'record:primary-checksum',
                ],
                'timelineStart' => 0,
                'sourceIn' => 0,
                'sourceOut' => 5,
            ]],
            actor: $actor,
        );

        $this->assertNull($manifest->width);
        $this->assertNull($manifest->height);
        $this->assertSame('media/source.mov', $manifest->sources[0]['path']);
        $this->assertSame('record:primary-checksum', $manifest->sources[0]['sourceVersionToken']);
        $this->assertArrayNotHasKey('remotePath', $manifest->sources[0]);
    }

    public function test_rejects_a_stale_source_version_token_for_an_existing_record(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('media/current.mov', 'current-source');
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'record-versioned',
            'data' => json_encode([
                'fileName' => 'current.mov',
                'filePath' => 'media/current.mov',
                'checksum' => 'current-checksum',
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $this->builder->build(
                preset: 'web-1080p',
                revisionId: (string) Str::uuid(),
                clips: [[
                    'id' => (string) Str::uuid(),
                    'source' => [
                        'recordId' => 'record-versioned',
                        'sourceVersionToken' => 'record:stale-checksum',
                    ],
                    'timelineStart' => 0,
                    'sourceIn' => 0,
                    'sourceOut' => 5,
                ]],
                actor: User::factory()->create(['role' => 'editor']),
            );
            $this->fail('A stale source version token must be rejected.');
        } catch (MontageValidationException $exception) {
            $this->assertArrayHasKey('clips.0.source.sourceVersionToken', $exception->errors);
        }
    }

    public function test_builds_a_manifest_from_an_allowlisted_preset(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('media/source.mov', 'trusted-source');
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'r1',
            'data' => json_encode([
                'fileName' => 'source.mov',
                'filePath' => 'media/source.mov',
                'checksum' => 'a',
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $manifest = $this->builder->build(
            preset: 'web-1080p',
            revisionId: 'rev-1',
            clips: [[
                'id' => 'c1',
                'source' => ['recordId' => 'r1', 'sourceVersionToken' => 'sha256:a'],
                'timelineStart' => 0,
                'sourceIn' => 2,
                'sourceOut' => 10,
            ]],
            actor: $this->actor,
        );

        $this->assertSame('rev-1', $manifest->revisionId);
        $this->assertSame(1920, $manifest->width);
        $this->assertSame(1080, $manifest->height);
        $this->assertSame('h264', $manifest->videoCodec);
        $this->assertSame('media/source.mov', $manifest->sources[0]['path']);
        $this->assertSame('record:a', $manifest->sources[0]['sourceVersionToken']);
        $this->assertSame(8.0, $manifest->clips[0]['durationSeconds']);
    }

    public function test_rejects_unknown_preset_and_client_codec_paths(): void
    {
        $this->expectException(MontageValidationException::class);
        $this->builder->build(
            preset: 'custom-4k-ffmpeg-graph',
            revisionId: 'rev-1',
            clips: [],
            actor: $this->actor,
        );
    }

    public function test_rejects_clips_referencing_local_paths(): void
    {
        $this->expectException(MontageValidationException::class);
        $this->builder->build(
            preset: 'web-1080p',
            revisionId: 'rev-1',
            clips: [[
                'id' => 'evil',
                'source' => ['recordId' => '../../../etc/passwd', 'sourceVersionToken' => 'x'],
                'timelineStart' => 0,
                'sourceIn' => 0,
                'sourceOut' => 5,
            ]],
            actor: $this->actor,
        );
    }
}
