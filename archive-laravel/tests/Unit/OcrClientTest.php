<?php

namespace Tests\Unit;

use App\Models\MediaJob;
use App\Services\Media\FakeProcessRunner;
use App\Services\Media\MediaPathGuard;
use App\Services\Media\OcrClient;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\WhisperTranscriber;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OcrClientTest extends TestCase
{
    public function test_extract_text_posts_file_and_returns_text(): void
    {
        Http::fake([
            'ocr-test:8788/ocr' => Http::response([
                'text' => 'Extracted document text',
                'lines' => [],
                'lang' => 'ar',
                'pageCount' => 1,
            ], 200),
        ]);

        $sourcePath = tempnam(sys_get_temp_dir(), 'ocr');
        file_put_contents($sourcePath, 'fake image bytes');

        $client = new OcrClient('http://ocr-test:8788');
        $text = $client->extractText($sourcePath);

        $this->assertSame('Extracted document text', $text);
        Http::assertSent(fn (Request $request): bool => $request->url() === 'http://ocr-test:8788/ocr' && $request->hasFile('file'));

        unlink($sourcePath);
    }

    public function test_extract_text_throws_on_failed_response(): void
    {
        Http::fake([
            'ocr-test:8788/ocr' => Http::response(['detail' => 'Cannot decode image'], 400),
        ]);

        $sourcePath = tempnam(sys_get_temp_dir(), 'ocr');
        file_put_contents($sourcePath, 'not an image');

        $client = new OcrClient('http://ocr-test:8788');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/OCR request failed/');

        try {
            $client->extractText($sourcePath);
        } finally {
            unlink($sourcePath);
        }
    }

    public function test_real_media_processor_ocr_branch_writes_artifact_and_delegates_to_client(): void
    {
        Http::fake([
            'ocr-test:8788/ocr' => Http::response(['text' => 'Scanned text body'], 200),
        ]);

        // MediaPathGuard requires source/output paths to resolve inside a
        // storage root (V1-111 containment); root this test at an isolated
        // temp dir and use relative recordId/sourcePath keys under it,
        // matching how the controller/processor use it in production.
        $root = sys_get_temp_dir().'/ocr-guard-'.uniqid();
        mkdir($root, 0777, true);
        $pathGuard = new MediaPathGuard($root);

        $recordId = 'ocr-record-'.uniqid();
        mkdir("{$root}/{$recordId}", 0777, true);
        $sourceRelative = "{$recordId}/source.jpg";
        file_put_contents("{$root}/{$sourceRelative}", 'fake image bytes');

        $runner = new FakeProcessRunner();
        $transcriber = new WhisperTranscriber($runner, 'whisper-ctranslate2', 'large-v3', 'ar', 'vtt');
        $processor = new RealMediaProcessor(
            $runner,
            $transcriber,
            'ffmpeg',
            'ffprobe',
            [],
            new OcrClient('http://ocr-test:8788'),
            null,
            $pathGuard,
        );

        $job = new MediaJob();
        $job->id = 'job-ocr';
        $job->record_id = $recordId;
        $job->operation = 'ocr';
        $job->source_path = $sourceRelative;
        $job->options = [];

        $artifacts = $processor->process($job);

        $this->assertCount(1, $artifacts);
        $this->assertSame('ocr_text', $artifacts[0]['kind']);
        $this->assertSame("{$recordId}/ocr.txt", $artifacts[0]['key']);
        $this->assertSame('Scanned text body', file_get_contents("{$root}/{$artifacts[0]['key']}"));

        array_map('unlink', glob("{$root}/{$recordId}/*"));
        rmdir("{$root}/{$recordId}");
        rmdir($root);
    }
}
