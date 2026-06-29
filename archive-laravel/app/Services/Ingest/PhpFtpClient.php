<?php

namespace App\Services\Ingest;

/**
 * Real FTP client using PHP's ext-ftp extension.
 *
 * ponytail: Live FTP server smoke tests deferred.
 * When real servers are available, run against them via a feature test.
 */
class PhpFtpClient implements FtpClient
{
    private mixed $connection = null;

    public function connect(string $host, int $port, string $user, string $password, bool $ssl = false): void
    {
        if (!extension_loaded('ftp')) {
            throw new \RuntimeException('ext-ftp not installed. Install with: apt-get install php-ftp');
        }

        $fn = $ssl ? 'ftp_ssl_connect' : 'ftp_connect';

        // phpstan complains about callable string, so we suppress
        /** @var callable */
        $connectFn = $fn;
        $this->connection = $connectFn($host, $port, 10); // 10s timeout

        if ($this->connection === false) {
            throw new \RuntimeException("FTP connection failed to {$host}:{$port}");
        }

        $loginResult = ftp_login($this->connection, $user, $password);
        if (!$loginResult) {
            ftp_close($this->connection);
            $this->connection = null;

            throw new \RuntimeException('FTP login failed');
        }

        // Passive mode for better compatibility
        ftp_pasv($this->connection, true);
    }

    /**
     * @return array<int, array{name: string, size: int, type: string}>
     */
    public function listFiles(string $remotePath): array
    {
        if ($this->connection === null) {
            throw new \RuntimeException('FTP connection not established');
        }

        $rawList = @ftp_nlist($this->connection, $remotePath);
        if ($rawList === false) {
            throw new \RuntimeException("FTP list failed for {$remotePath}");
        }

        // Filter out directory markers (. and ..) and directories themselves
        $files = [];
        foreach ($rawList as $item) {
            $name = basename($item);
            if ($name === '.' || $name === '..') {
                continue;
            }

            // Try to get size; if it fails, it's likely a directory
            $size = @ftp_size($this->connection, $item);
            if ($size === -1) {
                // -1 means it's a directory, skip it
                continue;
            }

            $files[] = [
                'name' => $name,
                'size' => $size,
                'type' => 'file',
            ];
        }

        return $files;
    }

    public function downloadFile(string $remotePath, string $localPath): void
    {
        if ($this->connection === null) {
            throw new \RuntimeException('FTP connection not established');
        }

        // Ensure parent directory exists
        $dir = dirname($localPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $result = @ftp_get($this->connection, $localPath, $remotePath, FTP_BINARY);
        if (!$result) {
            throw new \RuntimeException("FTP download failed for {$remotePath}");
        }
    }

    public function close(): void
    {
        if ($this->connection !== null) {
            @ftp_close($this->connection);
            $this->connection = null;
        }
    }

    public function __destruct()
    {
        $this->close();
    }
}
