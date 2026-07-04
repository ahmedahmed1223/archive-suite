<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class ImportPreviewController extends Controller
{
    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'max:2048'],
        ]);

        $url = trim((string) $validated['url']);
        $this->assertSafeUrl($url);

        $response = Http::timeout(10)->withOptions(['allow_redirects' => false])->head($url);

        if ($response->failed()) {
            return response()->json([
                'ok' => false,
                'error' => 'Could not reach the provided URL.',
                'code' => 'unreachable',
            ], 422);
        }

        $contentType = $response->header('Content-Type') ?: 'application/octet-stream';
        $contentLength = $response->header('Content-Length');

        return response()->json([
            'ok' => true,
            'preview' => [
                'url' => $url,
                'contentType' => $contentType,
                'contentLength' => $contentLength !== null ? (int) $contentLength : null,
                'suggestedType' => $this->suggestedType($contentType),
                'suggestedTitle' => $this->suggestedTitle($url),
            ],
        ]);
    }

    private function suggestedType(string $contentType): string
    {
        return match (true) {
            str_starts_with($contentType, 'video/') => 'video',
            str_starts_with($contentType, 'image/') => 'image',
            str_starts_with($contentType, 'audio/') => 'audio',
            str_starts_with($contentType, 'application/pdf') => 'document',
            default => 'file',
        };
    }

    private function suggestedTitle(string $url): string
    {
        $path = (string) parse_url($url, PHP_URL_PATH);
        $name = basename($path);

        return $name !== '' ? $name : $url;
    }

    private function assertSafeUrl(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw ValidationException::withMessages([
                'url' => 'The URL must use http or https.',
            ]);
        }

        if ($this->isPrivateOrLoopbackHost($host)) {
            throw ValidationException::withMessages([
                'url' => 'The URL must not point to a private or internal address.',
            ]);
        }
    }

    private function isPrivateOrLoopbackHost(string $host): bool
    {
        $lowerHost = strtolower($host);

        if ($lowerHost === 'localhost' || str_ends_with($lowerHost, '.localhost') || str_ends_with($lowerHost, '.local')) {
            return true;
        }

        $ips = [];
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $ips[] = $host;
        } else {
            $resolved = @gethostbynamel($host);
            if ($resolved !== false) {
                $ips = $resolved;
            }
        }

        if ($ips === []) {
            // Unresolvable host: fail closed rather than allow an unknown target through.
            return true;
        }

        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return true;
            }
        }

        return false;
    }
}
