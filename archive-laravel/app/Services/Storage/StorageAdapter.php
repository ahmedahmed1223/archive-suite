<?php

declare(strict_types=1);

namespace App\Services\Storage;

/**
 * Provider-neutral object storage boundary. Implementations must keep all
 * paths confined to their configured root and must support offset writes for
 * resumable transfers.
 */
interface StorageAdapter
{
    /** @return resource */
    public function readStream(string $path, int $offset = 0);

    /** @param resource $stream */
    public function writeStream(string $path, $stream, int $offset = 0): void;

    public function exists(string $path): bool;

    public function size(string $path): int;

    /** @return list<array{path:string,name:string,type:'file'|'directory',size:?int}> */
    public function list(string $path = ''): array;

    public function createDirectory(string $path): void;

    public function delete(string $path): void;

    public function move(string $from, string $to): void;

    public function copy(string $from, string $to): void;
}
