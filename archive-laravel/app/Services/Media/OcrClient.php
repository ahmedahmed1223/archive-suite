<?php

namespace App\Services\Media;

use Illuminate\Support\Facades\Http;

class OcrClient
{
    public function __construct(
        private readonly string $baseUrl = 'http://ocr:8788',
    ) {}

    /**
     * POST the source file to the ocr-service /ocr endpoint and return the
     * extracted text. Throws on a non-2xx response.
     */
    public function extractText(string $sourcePath): string
    {
        $response = Http::attach(
            'file',
            file_get_contents($sourcePath),
            basename($sourcePath),
        )->post("{$this->baseUrl}/ocr");

        if (! $response->successful()) {
            throw new \RuntimeException("OCR request failed: HTTP {$response->status()} {$response->body()}");
        }

        return (string) $response->json('text', '');
    }
}
