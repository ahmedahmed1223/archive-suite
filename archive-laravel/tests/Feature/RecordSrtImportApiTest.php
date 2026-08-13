<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordSrtImportApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_imports_srt_cues_and_transcript_for_a_record(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items', 'uid' => 'clip-1',
            'data' => json_encode(['id' => 'clip-1', 'title' => 'مقطع'], JSON_THROW_ON_ERROR),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $srt = "1\n00:00:01,500 --> 00:00:03,000\nمرحبا بالعالم\n\n2\n00:00:04,000 --> 00:00:05,250\nالنص الثاني";
        $file = UploadedFile::fake()->createWithContent('captions.srt', $srt);

        $this->postJson('/api/v1/records/clip-1/transcript/srt', [
            'file' => $file,
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.transcript', "مرحبا بالعالم\nالنص الثاني")
            ->assertJsonPath('record.transcriptCues.0.startSeconds', 1.5)
            ->assertJsonPath('record.transcriptCues.1.endSeconds', 5.25);
    }

    public function test_it_also_imports_webvtt_caption_files(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items', 'uid' => 'clip-vtt',
            'data' => json_encode(['id' => 'clip-vtt'], JSON_THROW_ON_ERROR),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $vtt = "WEBVTT\n\n1\n00:00:02.000 --> 00:00:04.500\nCaption text";

        $this->postJson('/api/v1/records/clip-vtt/transcript/subtitles', [
            'file' => UploadedFile::fake()->createWithContent('captions.vtt', $vtt),
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.transcript', 'Caption text')
            ->assertJsonPath('record.transcriptCues.0.endSeconds', 4.5)
            ->assertJsonPath('record.transcriptFormat', 'vtt');
    }

    public function test_it_saves_edited_subtitles_and_presentation_style(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items', 'uid' => 'clip-edit',
            'data' => json_encode(['id' => 'clip-edit'], JSON_THROW_ON_ERROR),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->putJson('/api/v1/records/clip-edit/transcript/subtitles', [
            'content' => "1\n00:00:01,000 --> 00:00:03,000\nنص محرر",
            'format' => 'srt',
            'style' => ['fontSize' => 26, 'color' => '#ffcc00', 'align' => 'middle'],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.transcript', 'نص محرر')
            ->assertJsonPath('record.transcriptStyle.fontSize', 26)
            ->assertJsonPath('record.transcriptStyle.color', '#ffcc00');
    }
}
