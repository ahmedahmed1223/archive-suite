<?php

declare(strict_types=1);

namespace App\Services\Storage;

use InvalidArgumentException;
use RuntimeException;

final class StreamTransfer
{
    public function __construct(private readonly int $chunkBytes = 1048576, private readonly int $maxRetries = 2)
    {
        if ($chunkBytes < 1 || $maxRetries < 0) throw new InvalidArgumentException('Invalid transfer limits.');
    }

    /**
     * @param 'skip'|'copy'|'replace' $conflictPolicy
     * @param null|callable():bool $cancelled
     * @return array{status:'completed'|'skipped'|'cancelled',path:string,bytesCopied:int,offset:int,sha256:?string}
     */
    public function copy(StorageAdapter $source, StorageAdapter $destination, string $sourcePath, string $destinationPath, string $conflictPolicy = 'skip', bool $replaceConfirmed = false, ?string $expectedSha256 = null, ?callable $cancelled = null): array
    {
        $sourcePath = StoragePath::normalize($sourcePath);
        $destinationPath = StoragePath::normalize($destinationPath);
        if (! in_array($conflictPolicy, ['skip', 'copy', 'replace'], true)) throw new InvalidArgumentException('Unknown conflict policy.');
        if ($destination->exists($destinationPath)) {
            if ($conflictPolicy === 'skip') return ['status' => 'skipped', 'path' => $destinationPath, 'bytesCopied' => 0, 'offset' => $destination->size($destinationPath), 'sha256' => null];
            if ($conflictPolicy === 'replace' && ! $replaceConfirmed) throw new InvalidArgumentException('Replace requires explicit confirmation.');
            if ($conflictPolicy === 'copy') $destinationPath = $this->copyPath($destination, $destinationPath);
        }

        $offset = $destination->exists($destinationPath) ? $destination->size($destinationPath) : 0;
        $sourceSize = $source->size($sourcePath);
        if ($offset > $sourceSize) throw new RuntimeException('Destination is larger than the source.');
        $fullSha256 = $expectedSha256 === null ? null : $this->sha256($source, $sourcePath);
        if ($expectedSha256 !== null && ! hash_equals(strtolower($expectedSha256), $fullSha256)) throw new RuntimeException('Source content checksum does not match expected SHA-256.');
        $stream = $source->readStream($sourcePath, $offset);
        $hash = hash_init('sha256');
        $copied = 0;
        try {
            while (! feof($stream)) {
                if ($cancelled !== null && $cancelled()) return ['status' => 'cancelled', 'path' => $destinationPath, 'bytesCopied' => $copied, 'offset' => $offset + $copied, 'sha256' => null];
                $chunk = fread($stream, $this->chunkBytes);
                if ($chunk === false) throw new RuntimeException('Unable to read storage source stream.');
                if ($chunk === '') continue;
                hash_update($hash, $chunk);
                $this->writeChunk($destination, $destinationPath, $chunk, $offset + $copied);
                $copied += strlen($chunk);
            }
        } finally { fclose($stream); }

        $sha256 = $fullSha256 ?? hash_final($hash);
        return ['status' => 'completed', 'path' => $destinationPath, 'bytesCopied' => $copied, 'offset' => $offset + $copied, 'sha256' => $sha256];
    }

    private function writeChunk(StorageAdapter $destination, string $path, string $chunk, int $offset): void
    {
        for ($attempt = 0; ; $attempt++) {
            $stream = fopen('php://temp/maxmemory:'.$this->chunkBytes, 'w+b');
            if ($stream === false) throw new RuntimeException('Unable to create bounded transfer buffer.');
            fwrite($stream, $chunk); rewind($stream);
            try { $destination->writeStream($path, $stream, $offset); fclose($stream); return; }
            catch (\Throwable $error) { fclose($stream); if ($attempt >= $this->maxRetries) throw $error; }
        }
    }

    private function copyPath(StorageAdapter $destination, string $path): string
    {
        $extension = pathinfo($path, PATHINFO_EXTENSION); $base = $extension === '' ? $path : substr($path, 0, -(strlen($extension) + 1));
        for ($index = 1; $destination->exists($candidate = $base.' (copy '.$index.')'.($extension === '' ? '' : '.'.$extension)); $index++) {}
        return $candidate;
    }

    private function sha256(StorageAdapter $source, string $path): string
    {
        $stream = $source->readStream($path);
        $hash = hash_init('sha256');
        try {
            while (! feof($stream)) {
                $chunk = fread($stream, $this->chunkBytes);
                if ($chunk === false) throw new RuntimeException('Unable to read storage source stream.');
                hash_update($hash, $chunk);
            }
        } finally { fclose($stream); }
        return hash_final($hash);
    }
}
