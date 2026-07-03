<?php

namespace Tests\Unit;

use App\Models\MediaJob;
use App\Services\Media\FakeProcessRunner;
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

        $sourcePath = tempnam(sys_get_temp_dir(), 'ocr');
        file_put_contents($sourcePath, 'fake image bytes');

        $runner = new FakeProcessRunner();
        $transcriber = new WhisperTranscriber($runner, 'whisper-ctranslate2', 'large-v3', 'ar', 'vtt');
        $processor = new RealMediaProcessor(
            $runner,
            $transcriber,
            'ffmpeg',
            'ffprobe',
            [],
            new OcrClient('http://ocr-test:8788'),
        );

        $job = new MediaJob();
        $job->id = 'job-ocr';
        $job->record_id = sys_get_temp_dir().'/ocr-record-'.uniqid();
        $job->operation = 'ocr';
        $job->source_path = $sourcePath;
        $job->options = [];

        mkdir($job->record_id, 0777, true);

        $artifacts = $processor->process($job);

        $this->assertCount(1, $artifacts);
        $this->assertSame('ocr_text', $artifacts[0]['kind']);
        $this->assertSame('Scanned text body', file_get_contents($artifacts[0]['key']));

        unlink($sourcePath);
        unlink($artifacts[0]['key']);
        rmdir($job->record_id);
    }
}
