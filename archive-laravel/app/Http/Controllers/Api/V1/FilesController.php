<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use FilesystemIterator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

class FilesController extends Controller
{
    public function index(): JsonResponse
    {
        $root = $this->rootPath();

        if (! is_dir($root)) {
            return response()->json(['ok' => true, 'files' => []]);
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        );
        $files = [];

        foreach ($iterator as $file) {
            if ($file instanceof SplFileInfo && $file->isFile()) {
                $files[] = $this->formatEntry($file, $root);
            }

            if (count($files) >= 200) {
                break;
            }
        }

        usort($files, fn (array $a, array $b): int => strcmp($a['key'], $b['key']));

        return response()->json(['ok' => true, 'files' => $files]);
    }

    public function browser(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'path' => ['nullable', 'string'],
            'query' => ['nullable', 'string'],
        ]);

        $root = $this->rootPath();
        $path = $this->resolvePath($root, (string) ($validated['path'] ?? ''));

        if ($path === null) {
            return response()->json(['ok' => false, 'error' => 'Invalid file browser path.'], 400);
        }

        if (! is_dir($path)) {
            return response()->json(['ok' => false, 'error' => 'Directory not found.'], 404);
        }

        $query = mb_strtolower((string) ($validated['query'] ?? ''));
        $entries = [];

        foreach (new FilesystemIterator($path, FilesystemIterator::SKIP_DOTS) as $file) {
            if (! $file instanceof SplFileInfo) {
                continue;
            }

            if ($query !== '' && ! str_contains(mb_strtolower($file->getFilename()), $query)) {
                continue;
            }

            $entries[] = $this->formatEntry($file, $root);
        }

        usort($entries, fn (array $a, array $b): int => [$a['kind'], $a['name']] <=> [$b['kind'], $b['name']]);

        return response()->json([
            'ok' => true,
            'path' => $this->relativePath($path, $root),
            'items' => $entries,
        ]);
    }

    public function stream(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        $validated = $request->validate([
            'path' => ['required', 'string'],
            'disk' => ['nullable', 'string'],
        ]);

        $disk = (string) ($validated['disk'] ?? '');

        // If disk is specified, stream from the configured filesystem disk
        if ($disk !== '') {
            return $this->streamFromDisk($request, $disk, (string) $validated['path']);
        }

        // Fallback: stream from ARCHIVE_FILE_ROOT (original behavior, Range-capable)
        $root = $this->rootPath();
        $path = $this->resolvePath($root, (string) $validated['path']);

        if ($path === null) {
            return response()->json(['ok' => false, 'error' => 'Invalid media path.'], 400);
        }

        if (! is_file($path)) {
            return response()->json(['ok' => false, 'error' => 'Media not found.'], 404);
        }

        $mime = mime_content_type($path) ?: 'application/octet-stream';

        // Symfony BinaryFileResponse handles HTTP Range (206 partial / 416
        // unsatisfiable), Accept-Ranges, and chunked sending natively for local files.
        return response()->file($path, [
            'Content-Type' => $mime,
            'Cache-Control' => 'private, max-age=0, no-cache',
        ]);
    }

    private function streamFromDisk(Request $request, string $diskName, string $path): \Symfony\Component\HttpFoundation\Response
    {
        // Security: only allow disks in the configured filesystem disks array
        $allowedDisks = array_keys((array) config('filesystems.disks', []));

        if (! in_array($diskName, $allowedDisks, true)) {
            return response()->json(['ok' => false, 'error' => 'Invalid disk.'], 400);
        }

        // Security: reject path traversal (no .. segments or leading slash)
        if (str_contains($path, '..') || str_starts_with($path, '/')) {
            return response()->json(['ok' => false, 'error' => 'Invalid file path.'], 400);
        }

        $disk = \Illuminate\Support\Facades\Storage::disk($diskName);

        // Check file exists
        if (! $disk->exists($path)) {
            return response()->json(['ok' => false, 'error' => 'Media not found.'], 404);
        }

        $localPath = $this->localDiskPath($diskName, $path);
        if ($localPath !== null) {
            $mime = mime_content_type($localPath) ?: 'application/octet-stream';

            return response()->file($localPath, [
                'Content-Type' => $mime,
                'Cache-Control' => 'private, max-age=0, no-cache',
            ]);
        }

        $mime = $disk->mimeType($path) ?: 'application/octet-stream';

        $size = (int) $disk->size($path);
        $range = $this->parseByteRange($request->header('Range'), $size);

        if ($range === false) {
            return response('', 416, [
                'Content-Range' => "bytes */{$size}",
                'Accept-Ranges' => 'bytes',
                'Cache-Control' => 'private, max-age=0, no-cache',
            ]);
        }

        [$start, $end] = $range ?? [0, max(0, $size - 1)];
        $length = $range === null ? $size : $end - $start + 1;

        return response()->stream(
            function () use ($disk, $path, $start, $length): void {
                $stream = $disk->readStream($path);

                if (! is_resource($stream)) {
                    return;
                }

                try {
                    if ($start > 0) {
                        $metadata = stream_get_meta_data($stream);

                        if (($metadata['seekable'] ?? false) !== true || fseek($stream, $start, SEEK_SET) !== 0) {
                            $this->discardStreamBytes($stream, $start);
                        }
                    }

                    $remaining = $length;

                    while ($remaining > 0 && ! feof($stream)) {
                        $chunk = fread($stream, min(8192, $remaining));

                        if ($chunk === false || $chunk === '') {
                            break;
                        }

                        $remaining -= strlen($chunk);
                        echo $chunk;
                    }
                } finally {
                    fclose($stream);
                }
            },
            $range === null ? 200 : 206,
            [
                'Content-Type' => $mime,
                'Content-Length' => $length,
                'Cache-Control' => 'private, max-age=0, no-cache',
                'Accept-Ranges' => 'bytes',
                ...($range === null ? [] : ['Content-Range' => "bytes {$start}-{$end}/{$size}"]),
            ]
        );
    }

    /**
     * @return array{int, int}|false|null null when no Range header was sent
     */
    private function parseByteRange(?string $header, int $size): array|false|null
    {
        if ($header === null || trim($header) === '') {
            return null;
        }

        if ($size < 1 || ! str_starts_with($header, 'bytes=') || str_contains($header, ',')) {
            return false;
        }

        $range = trim(substr($header, strlen('bytes=')));

        if (! preg_match('/^(\d*)-(\d*)$/', $range, $matches) || ($matches[1] === '' && $matches[2] === '')) {
            return false;
        }

        if ($matches[1] === '') {
            $suffixLength = (int) $matches[2];

            if ($suffixLength < 1) {
                return false;
            }

            return [max(0, $size - $suffixLength), $size - 1];
        }

        $start = (int) $matches[1];

        if ($start >= $size) {
            return false;
        }

        $end = $matches[2] === '' ? $size - 1 : min((int) $matches[2], $size - 1);

        return $end < $start ? false : [$start, $end];
    }

    /** @param resource $stream */
    private function discardStreamBytes($stream, int $bytes): void
    {
        while ($bytes > 0 && ! feof($stream)) {
            $chunk = fread($stream, min(8192, $bytes));

            if ($chunk === false || $chunk === '') {
                return;
            }

            $bytes -= strlen($chunk);
        }
    }

    private function localDiskPath(string $diskName, string $path): ?string
    {
        $config = (array) config("filesystems.disks.{$diskName}", []);

        if (($config['driver'] ?? null) !== 'local' || ! is_string($config['root'] ?? null)) {
            return null;
        }

        $root = realpath($config['root']);
        if ($root === false) {
            return null;
        }

        $candidate = realpath($root.DIRECTORY_SEPARATOR.ltrim($path, '/\\'));
        if ($candidate === false) {
            return null;
        }

        $rootPrefix = rtrim($root, DIRECTORY_SEPARATOR.'/\\').DIRECTORY_SEPARATOR;

        return str_starts_with($candidate, $rootPrefix) ? $candidate : null;
    }

    private function rootPath(): string
    {
        return rtrim((string) config('archive.file_root'), DIRECTORY_SEPARATOR);
    }

    private function resolvePath(string $root, string $path): ?string
    {
        $rootReal = realpath($root);

        if ($rootReal === false) {
            return $path === '' ? $root : null;
        }

        $candidate = realpath($rootReal.DIRECTORY_SEPARATOR.ltrim($path, '/\\'));

        if ($candidate === false || ! str_starts_with($candidate, $rootReal)) {
            return null;
        }

        return $candidate;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatEntry(SplFileInfo $file, string $root): array
    {
        $path = $file->getPathname();
        $relative = $this->relativePath($path, $root);

        return [
            'key' => $relative,
            'name' => $file->getFilename(),
            'path' => $relative,
            'kind' => $file->isDir() ? 'folder' : 'file',
            'mimeType' => $file->isFile() ? (mime_content_type($path) ?: 'application/octet-stream') : null,
            'size' => $file->isFile() ? $file->getSize() : null,
            'modifiedAt' => date(DATE_ATOM, $file->getMTime()),
        ];
    }

    private function relativePath(string $path, string $root): string
    {
        $relative = ltrim(substr($path, strlen($root)), DIRECTORY_SEPARATOR.'/\\');

        return str_replace(DIRECTORY_SEPARATOR, '/', $relative);
    }
}
