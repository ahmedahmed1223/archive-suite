<?php

namespace App\Services\Ingest;

/**
 * Fake FTP client for testing.
 */
class FakeFtpClient implements FtpClient
{
    /**
     * Map of remote paths to file lists.
     *
     * @var array<string, array<int, array{name: string, size: int, type: string}>>
     */
    private array $fileLists = [];

    /**
     * Map of remote file paths to local content.
     *
     * @var array<string, string>
     */
    private array $fileContents = [];

    /**
     * Set the fake file list for a remote directory.
     */
    public function setFileList(string $remotePath, array $files): void
    {
        $this->fileLists[$remotePath] = $files;
    }

    /**
     * Set the fake content for a remote file.
     */
    public function setFileContent(string $remotePath, string $content): void
    {
        $this->fileContents[$remotePath] = $content;
    }

    public function connect(string $host, int $port, string $user, string $password, bool $ssl = false): void
    {
        // Fake: always succeeds
    }

    /**
     * @return array<int, array{name: string, size: int, type: string}>
     */
    public function listFiles(string $remotePath): array
    {
        return $this->fileLists[$remotePath] ?? [];
    }

    public function downloadFile(string $remotePath, string $localPath): void
    {
        if (!isset($this->fileContents[$remotePath])) {
            throw new \RuntimeException("Fake FTP: file not found {$remotePath}");
        }

        $dir = dirname($localPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        file_put_contents($localPath, $this->fileContents[$remotePath]);
    }

    public function close(): void
    {
        // Fake: no-op
    }
}
