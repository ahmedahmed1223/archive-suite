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
     * @param  string  $host
     * @param  int  $port
     * @param  string  $user
     * @param  string  $password
     * @param  bool  $ssl
     *
     * @throws \Exception on connection failure
     */
    public function connect(string $host, int $port, string $user, string $password, bool $ssl = false): void;

    /**
     * List files in a directory.
     *
     * @param  string  $remotePath
     * @return array<int, array{name: string, size: int, type: string}>
     *
     * @throws \Exception on list failure
     */
    public function listFiles(string $remotePath): array;

    /**
     * Download a file to a local path.
     *
     * @param  string  $remotePath
     * @param  string  $localPath
     *
     * @throws \Exception on download failure
     */
    public function downloadFile(string $remotePath, string $localPath): void;

    /**
     * Close the connection.
     */
    public function close(): void;
}
