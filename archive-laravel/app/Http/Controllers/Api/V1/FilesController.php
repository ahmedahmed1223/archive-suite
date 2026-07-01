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
        ]);

        $root = $this->rootPath();
        $path = $this->resolvePath($root, (string) $validated['path']);

        if ($path === null) {
            return response()->json(['ok' => false, 'error' => 'Invalid media path.'], 400);
        }

        if (! is_file($path)) {
            return response()->json(['ok' => false, 'error' => 'Media not found.'], 404);
        }

        $mime = mime_content_type($path) ?: 'application/octet-stream';

        // ponytail: Symfony BinaryFileResponse handles HTTP Range (206 partial /
        // 416 unsatisfiable), Accept-Ranges, and chunked sending natively, so the
        // browser streams and seeks local media over HTTP — no file://, no
        // whole-file buffering. Remote disks (s3/ftp/sftp) are a follow-up slice.
        return response()->file($path, [
            'Content-Type' => $mime,
            'Cache-Control' => 'private, max-age=0, no-cache',
        ]);
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
