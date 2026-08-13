<?php

namespace App\Services\Ingest;

/**
 * Abstraction over FTP client operations for testability.
 */
interface FtpClient
{
    /**
     * Connect and authenticate.
     *
     *
     * @throws \Exception on connection failure
     */
    public function connect(string $host, int $port, string $user, string $password, bool $ssl = false): void;

    /**
     * List files in a directory.
     *
     * @return array<int, array{name: string, size: int, type: string}>
     *
     * @throws \Exception on list failure
     */
    public function listFiles(string $remotePath): array;

    /**
     * Download a file to a local path.
     *
     *
     * @throws \Exception on download failure
     */
    public function downloadFile(string $remotePath, string $localPath): void;

    /**
     * Close the connection.
     */
    public function close(): void;
}
