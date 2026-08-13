<?php

declare(strict_types=1);

namespace App\Services\Storage;

use Illuminate\Contracts\Filesystem\Filesystem;
use RuntimeException;

/** Laravel/Flysystem adapter with root-confined browsing and mutations. */
final class FlysystemStorageAdapter implements StorageAdapter
{
    public function __construct(private readonly Filesystem $disk) {}

    public function readStream(string $path, int $offset = 0)
    {
        $stream = $this->disk->readStream(StoragePath::normalize($path));
        if (! is_resource($stream)) {
            throw new RuntimeException('Unable to open storage source stream.');
        }
        if ($offset > 0 && fseek($stream, $offset) !== 0) {
            fclose($stream);
            throw new RuntimeException('Storage source does not support resume offsets.');
        }

        return $stream;
    }

    public function writeStream(string $path, $stream, int $offset = 0): void
    {
        $path = StoragePath::normalize($path);
        if (! is_resource($stream)) {
            throw new RuntimeException('Storage destination stream is invalid.');
        }
        // Flysystem's generic API has no portable append primitive. Providers
        // that advertise resumable writes supply a native adapter; refusing an
        // offset here prevents silently corrupting a destination object.
        if ($offset !== 0) {
            throw new RuntimeException('Storage destination does not support resume offsets.');
        }
        if (! $this->disk->put($path, $stream)) {
            throw new RuntimeException('Unable to write storage destination stream.');
        }
    }

    public function exists(string $path): bool
    {
        return $this->disk->exists(StoragePath::normalize($path));
    }

    public function size(string $path): int
    {
        return $this->disk->size(StoragePath::normalize($path));
    }

    public function list(string $path = ''): array
    {
        $path = StoragePath::normalize($path);

        return collect($this->disk->listContents($path, false))->map(function ($entry): array {
            $isDirectory = $entry->isDir();

            return ['path' => $entry->path(), 'name' => basename($entry->path()), 'type' => $isDirectory ? 'directory' : 'file', 'size' => $isDirectory ? null : $entry->fileSize()];
        })->values()->all();
    }

    public function createDirectory(string $path): void
    {
        $this->disk->makeDirectory(StoragePath::normalize($path));
    }

    public function delete(string $path): void
    {
        $this->disk->delete(StoragePath::normalize($path));
    }

    public function move(string $from, string $to): void
    {
        $this->disk->move(StoragePath::normalize($from), StoragePath::normalize($to));
    }

    public function copy(string $from, string $to): void
    {
        $this->disk->copy(StoragePath::normalize($from), StoragePath::normalize($to));
    }
}
