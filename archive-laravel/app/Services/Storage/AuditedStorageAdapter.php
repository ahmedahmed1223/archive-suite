<?php

declare(strict_types=1);

namespace App\Services\Storage;

/** Adds redacted, provider-independent audit events around storage mutations. */
final class AuditedStorageAdapter implements StorageAdapter
{
    /** @param callable(string, array<string, mixed>):void $audit */
    public function __construct(private readonly StorageAdapter $adapter, private readonly mixed $audit) {}

    public function readStream(string $path, int $offset = 0)
    {
        return $this->adapter->readStream($path, $offset);
    }

    public function writeStream(string $path, $stream, int $offset = 0): void
    {
        $this->adapter->writeStream($path, $stream, $offset);
        $this->record('write', ['path' => $path, 'offset' => $offset]);
    }

    public function exists(string $path): bool
    {
        return $this->adapter->exists($path);
    }

    public function size(string $path): int
    {
        return $this->adapter->size($path);
    }

    public function list(string $path = ''): array
    {
        return $this->adapter->list($path);
    }

    public function createDirectory(string $path): void
    {
        $this->adapter->createDirectory($path);
        $this->record('create_directory', ['path' => $path]);
    }

    public function delete(string $path): void
    {
        $this->adapter->delete($path);
        $this->record('delete', ['path' => $path]);
    }

    public function move(string $from, string $to): void
    {
        $this->adapter->move($from, $to);
        $this->record('move', ['from' => $from, 'to' => $to]);
    }

    public function copy(string $from, string $to): void
    {
        $this->adapter->copy($from, $to);
        $this->record('copy', ['from' => $from, 'to' => $to]);
    }

    /** @param array<string, mixed> $payload */
    private function record(string $action, array $payload): void
    {
        ($this->audit)($action, StorageAuditPayload::redact($payload));
    }
}
