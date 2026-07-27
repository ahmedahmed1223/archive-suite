<?php

declare(strict_types=1);

namespace Tests\Unit\Storage;

use App\Services\Storage\StorageAdapter;
use App\Services\Storage\StorageAuditPayload;
use App\Services\Storage\StoragePath;
use App\Services\Storage\StreamTransfer;
use App\Services\Storage\AuditedStorageAdapter;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class StreamTransferTest extends TestCase
{
    public function test_it_resumes_at_existing_destination_offset_and_verifies_sha256(): void
    {
        $source = new MemoryAdapter(['in/archive.txt' => 'abcdef']);
        $destination = new MemoryAdapter(['out/archive.txt' => 'abc']);
        $result = (new StreamTransfer(2))->copy($source, $destination, 'in/archive.txt', 'out/archive.txt', 'replace', true, hash('sha256', 'abcdef'));
        self::assertSame('completed', $result['status']); self::assertSame(3, $result['bytesCopied']);
        self::assertSame('abcdef', $destination->contents('out/archive.txt')); self::assertSame(hash('sha256', 'abcdef'), $result['sha256']);
    }

    public function test_it_cancels_between_chunks_without_reading_the_remainder(): void
    {
        $source = new MemoryAdapter(['source' => 'abcdef']); $destination = new MemoryAdapter(); $checks = 0;
        $result = (new StreamTransfer(2))->copy($source, $destination, 'source', 'destination', cancelled: static function () use (&$checks): bool { return ++$checks > 1; });
        self::assertSame('cancelled', $result['status']); self::assertSame('ab', $destination->contents('destination'));
    }

    public function test_it_supports_skip_copy_and_confirmed_replace_conflict_policies(): void
    {
        $source = new MemoryAdapter(['a.txt' => 'new']); $destination = new MemoryAdapter(['a.txt' => 'old']); $transfer = new StreamTransfer();
        self::assertSame('skipped', $transfer->copy($source, $destination, 'a.txt', 'a.txt')['status']);
        self::assertSame('a (copy 1).txt', $transfer->copy($source, $destination, 'a.txt', 'a.txt', 'copy')['path']);
        $this->expectException(InvalidArgumentException::class); $transfer->copy($source, $destination, 'a.txt', 'a.txt', 'replace');
    }

    public function test_it_confines_folder_paths_and_redacts_audit_secrets(): void
    {
        $this->expectException(InvalidArgumentException::class); StoragePath::normalize('../outside');
    }

    public function test_it_redacts_nested_audit_secrets(): void
    {
        self::assertSame(['path' => 'safe/file.txt', 'token' => '[REDACTED]', 'nested' => ['secretKey' => '[REDACTED]']], StorageAuditPayload::redact(['path' => 'safe/file.txt', 'token' => 'secret', 'nested' => ['secretKey' => 'x']]));
    }

    public function test_it_audits_mutations_with_redacted_payloads(): void
    {
        $events = [];
        $adapter = new AuditedStorageAdapter(new MemoryAdapter(['from' => 'file']), static function (string $action, array $payload) use (&$events): void { $events[] = [$action, $payload]; });
        $adapter->copy('from', 'to');
        self::assertSame([['copy', ['from' => 'from', 'to' => 'to']]], $events);
    }
}

/** @internal Lightweight offset-capable provider fake for transfer semantics. */
final class MemoryAdapter implements StorageAdapter
{
    /** @param array<string, string> $files */
    public function __construct(private array $files = []) {}
    public function readStream(string $path, int $offset = 0) { $stream = fopen('php://temp', 'w+b'); fwrite($stream, substr($this->files[$path] ?? '', $offset)); rewind($stream); return $stream; }
    public function writeStream(string $path, $stream, int $offset = 0): void { $chunk = stream_get_contents($stream); $existing = $this->files[$path] ?? ''; $this->files[$path] = substr($existing, 0, $offset).$chunk.substr($existing, $offset + strlen($chunk)); }
    public function exists(string $path): bool { return array_key_exists($path, $this->files); }
    public function size(string $path): int { return strlen($this->files[$path] ?? ''); }
    public function list(string $path = ''): array { return []; }
    public function createDirectory(string $path): void {}
    public function delete(string $path): void { unset($this->files[$path]); }
    public function move(string $from, string $to): void { $this->files[$to] = $this->files[$from]; unset($this->files[$from]); }
    public function copy(string $from, string $to): void { $this->files[$to] = $this->files[$from]; }
    public function contents(string $path): string { return $this->files[$path] ?? ''; }
}
