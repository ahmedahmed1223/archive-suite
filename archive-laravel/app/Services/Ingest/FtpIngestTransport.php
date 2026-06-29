<?php

namespace App\Services\Ingest;

use Illuminate\Support\Facades\Storage;

/**
 * FTP-based ingest transport.
 *
 * Pulls files from a remote FTP server into the local ingest disk.
 */
class FtpIngestTransport implements IngestTransport
{
    public function __construct(private readonly FtpClient $client)
    {
    }

    /**
     * Pull files from FTP server.
     *
     * @param  array<string, mixed>  $params Connection parameters:
     *   - host: FTP server host
     *   - port: FTP server port (default 21)
     *   - user: FTP username
     *   - password: FTP password
     *   - remotePath: Remote directory path (e.g., "/uploads")
     *   - ssl: Use FTPS (default false)
     *
     * @return array<int, string> Local file keys on ingest disk
     *
     * @throws \RuntimeException on FTP failure
     */
    public function pull(array $params): array
    {
        $host = $params['host'] ?? null;
        $port = (int) ($params['port'] ?? 21);
        $user = $params['user'] ?? null;
        $password = $params['password'] ?? null;
        $remotePath = $params['remotePath'] ?? '/';
        $ssl = (bool) ($params['ssl'] ?? false);

        if (!$host || !$user) {
            throw new \RuntimeException('FTP pull requires host and user parameters');
        }

        try {
            $this->client->connect($host, $port, $user, $password, $ssl);

            // List remote files
            $files = $this->client->listFiles($remotePath);

            // Download each file to ingest disk
            $ingestDisk = Storage::disk(config('ingest.disk'));
            $ingestDir = config('ingest.directory', 'ingest');
            $keys = [];

            foreach ($files as $fileInfo) {
                $fileName = $fileInfo['name'];
                $remoteName = rtrim($remotePath, '/') . '/' . $fileName;
                $localKey = $ingestDir . '/' . $fileName;

                // Create a temporary path for download
                $tempPath = sys_get_temp_dir() . '/' . uniqid('ingest_', true) . '_' . $fileName;

                try {
                    // Download to temp
                    $this->client->downloadFile($remoteName, $tempPath);

                    // Move to ingest disk
                    if (file_exists($tempPath)) {
                        $content = file_get_contents($tempPath);
                        if ($content === false) {
                            throw new \RuntimeException("Failed to read downloaded file: {$tempPath}");
                        }

                        $ingestDisk->put($localKey, $content);
                        $keys[] = $localKey;

                        @unlink($tempPath);
                    }
                } catch (\Throwable $e) {
                    @unlink($tempPath);
                    throw $e;
                }
            }

            return $keys;
        } finally {
            $this->client->close();
        }
    }
}
