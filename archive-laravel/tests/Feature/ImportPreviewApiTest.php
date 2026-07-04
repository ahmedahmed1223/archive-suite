<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class ImportPreviewApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_previews_metadata_for_a_valid_public_url(): void
    {
        Http::fake([
            'https://example.com/video.mp4' => Http::response('', 200, [
                'Content-Type' => 'video/mp4',
                'Content-Length' => '12345',
            ]),
        ]);

        $this->postJson('/api/v1/import/preview', [
            'url' => 'https://example.com/video.mp4',
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('preview.url', 'https://example.com/video.mp4')
            ->assertJsonPath('preview.contentType', 'video/mp4')
            ->assertJsonPath('preview.suggestedType', 'video')
            ->assertJsonPath('preview.contentLength', 12345);
    }

    public function test_it_rejects_non_http_schemes(): void
    {
        $this->postJson('/api/v1/import/preview', [
            'url' => 'ftp://example.com/file.mp4',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_private_and_loopback_hosts(): void
    {
        foreach (['http://127.0.0.1/secret', 'http://localhost/secret', 'http://192.168.1.5/x', 'http://10.0.0.1/x', 'http://169.254.169.254/latest/meta-data'] as $url) {
            $this->postJson('/api/v1/import/preview', [
                'url' => $url,
            ], $this->authHeaders())
                ->assertUnprocessable()
                ->assertJsonPath('errors.url.0', 'The URL must not point to a private or internal address.');
        }
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->postJson('/api/v1/import/preview', [
            'url' => 'https://example.com/video.mp4',
        ])->assertUnauthorized();
    }
}
