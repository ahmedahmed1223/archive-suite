<?php

namespace App\Services\Media;

use RuntimeException;

/**
 * Guards every path a media job hands to ffmpeg/whisper/OCR or the filesystem.
 * Client-supplied values (sourcePath, recordId, clip paths, watermark
 * overrides) must never resolve outside the archive storage root
 * (config('archive.file_root'), storage/app/archive-files by default) —
 * this is what stops path traversal and arbitrary file reads (V1-111).
 */
class MediaPathGuard
{
    public function __construct(private readonly ?string $root = null) {}

    /**
     * Shape-only check (no filesystem access): rejects absolute paths and any
     * `..` segment. Safe to use directly on untrusted request input.
     */
    public static function isSafeRelative(?string $path): bool
    {
        if ($path === null || trim($path) === '') {
            return false;
        }

        if (str_starts_with($path, '/') || str_starts_with($path, '\\')) {
            return false;
        }

        if (preg_match('#^[A-Za-z]:[\\\\/]#', $path) === 1) {
            return false;
        }

        foreach (preg_split('#[\\\\/]+#', $path) ?: [] as $segment) {
            if ($segment === '..' || $segment === '') {
                return false;
            }
        }

        return true;
    }

    /**
     * Resolve a client-supplied relative path to an absolute path inside the
     * storage root. Throws on traversal or absolute paths — the check that
     * actually stops `../../.env` and `/etc/passwd` reads, independent of
     * whether the target exists.
     *
     * When the target exists, it's canonicalized via realpath() and the
     * prefix is re-checked, which also catches symlink escapes (a symlink
     * planted inside the root pointing outside it). When it doesn't exist
     * yet, the already-validated safe relative path is simply joined onto
     * the root — it cannot escape since it has no ".." or absolute segment.
     */
    public function resolveInput(?string $relativePath, string $label = 'path'): string
    {
        $safe = $this->assertSafeRelative($relativePath, $label);
        $rootReal = $this->ensureRoot();
        $prefix = $rootReal.DIRECTORY_SEPARATOR;
        $joined = $rootReal.DIRECTORY_SEPARATOR.$safe;

        $canonical = realpath($joined);
        if ($canonical === false) {
            return $joined;
        }

        if (! str_starts_with($canonical.DIRECTORY_SEPARATOR, $prefix)) {
            throw new RuntimeException("Invalid {$label}: outside the media storage root.");
        }

        return $canonical;
    }

    /**
     * Resolve a server-built relative key (e.g. "{recordId}/thumb.jpg") to an
     * absolute path under the storage root, creating the parent directory.
     * recordId is client-supplied, so this still runs the traversal check.
     */
    public function resolveOutput(string $relativeKey, string $label = 'path'): string
    {
        $safe = $this->assertSafeRelative($relativeKey, $label);
        $rootReal = $this->ensureRoot();

        $absolute = $rootReal.DIRECTORY_SEPARATOR.$safe;
        $dir = dirname($absolute);

        if (! is_dir($dir) && ! @mkdir($dir, 0777, true) && ! is_dir($dir)) {
            throw new RuntimeException("Unable to create output directory for {$label}.");
        }

        $dirReal = realpath($dir);
        $prefix = $rootReal.DIRECTORY_SEPARATOR;

        if ($dirReal === false || ! str_starts_with($dirReal.DIRECTORY_SEPARATOR, $prefix)) {
            throw new RuntimeException("Invalid {$label}: resolves outside the media storage root.");
        }

        return $absolute;
    }

    /**
     * Resolve (creating if needed) a server-built relative directory under
     * the storage root. Empty/"." resolves to the root itself.
     */
    public function resolveOutputDir(string $relativeDir, string $label = 'path'): string
    {
        if (trim($relativeDir) === '' || $relativeDir === '.') {
            return $this->ensureRoot();
        }

        $safe = $this->assertSafeRelative($relativeDir, $label);
        $rootReal = $this->ensureRoot();

        $absolute = $rootReal.DIRECTORY_SEPARATOR.$safe;

        if (! is_dir($absolute) && ! @mkdir($absolute, 0777, true) && ! is_dir($absolute)) {
            throw new RuntimeException("Unable to create directory for {$label}.");
        }

        $absReal = realpath($absolute);
        $prefix = $rootReal.DIRECTORY_SEPARATOR;

        if ($absReal === false || ! str_starts_with($absReal.DIRECTORY_SEPARATOR, $prefix)) {
            throw new RuntimeException("Invalid {$label}: resolves outside the media storage root.");
        }

        return $absReal;
    }

    /**
     * Join a relative key onto the root without touching the filesystem.
     * For reading back files this process just wrote via resolveOutput*,
     * where a missing file is a normal (not security-relevant) condition
     * the caller already handles with is_file().
     */
    public function absolutePath(string $relativeKey, string $label = 'path'): string
    {
        $safe = $this->assertSafeRelative($relativeKey, $label);

        return $this->ensureRoot().DIRECTORY_SEPARATOR.$safe;
    }

    private function assertSafeRelative(?string $path, string $label): string
    {
        if (! self::isSafeRelative($path)) {
            throw new RuntimeException("Invalid {$label}: must be a relative path without traversal.");
        }

        return $path;
    }

    private function rootPath(): string
    {
        if ($this->root !== null) {
            return rtrim($this->root, '/\\');
        }

        try {
            return rtrim((string) config('archive.file_root'), '/\\');
        } catch (\Throwable) {
            // No Laravel app bootstrapped — e.g. plain PHPUnit unit tests that
            // construct these media services directly without DI. Fall back to
            // the working directory, matching how these relative paths always
            // resolved before containment existed.
            return rtrim((string) getcwd(), '/\\');
        }
    }

    private function ensureRoot(): string
    {
        $root = $this->rootPath();

        if (! is_dir($root) && ! @mkdir($root, 0777, true) && ! is_dir($root)) {
            throw new RuntimeException('Unable to create media storage root.');
        }

        $rootReal = realpath($root);
        if ($rootReal === false) {
            throw new RuntimeException('Media storage root is not available.');
        }

        return $rootReal;
    }
}
