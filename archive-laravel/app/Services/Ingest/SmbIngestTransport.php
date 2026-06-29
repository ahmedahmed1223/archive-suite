<?php

namespace App\Services\Ingest;

use App\Services\Media\ProcessRunner;
use Illuminate\Support\Facades\Storage;

/**
 * SMB/CIFS-based ingest transport.
 *
 * Pulls files from a remote SMB/CIFS share into the local ingest disk.
 * Uses `smbclient` command-line tool via ProcessRunner for testability.
 *
 * ponytail: Live SMB server smoke tests deferred.
 * When real servers are available, run against them via a feature test.
 */
class SmbIngestTransport implements IngestTransport
{
    public function __construct(private readonly ProcessRunner $runner)
    {
    }

    /**
     * Pull files from SMB share.
     *
     * @param  array<string, mixed>  $params Connection parameters:
     *   - host: SMB server hostname or IP
     *   - share: SMB share name (e.g., "media")
     *   - user: SMB username
     *   - password: SMB password
     *   - remotePath: Remote directory path within share (default "/")
     *
     * @return array<int, string> Local file keys on ingest disk
     *
     * @throws \RuntimeException on SMB failure
     */
    public function pull(array $params): array
    {
        $host = $params['host'] ?? null;
        $share = $params['share'] ?? null;
        $user = $params['user'] ?? null;
        $password = $params['password'] ?? null;
        $remotePath = $params['remotePath'] ?? '/';

        if (!$host || !$share || !$user) {
            throw new \RuntimeException('SMB pull requires host, share, and user parameters');
        }

        // Normalize remote path
        $remotePath = trim($remotePath, '/');

        // Build smbclient UNC path: //host/share/path
        $uncPath = "///{$host}/{$share}";
        if ($remotePath) {
            $uncPath .= "/{$remotePath}";
        }

        // List files in remote directory
        $listCmd = [
            'smbclient',
            $uncPath,
            '-U',
            $user . '%' . $password,
            '-c',
            'ls',
        ];

        $result = $this->runner->run($listCmd);

        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException(
                "SMB list failed: {$result['stderr']}"
            );
        }

        // Parse smbclient ls output to extract file names
        $fileNames = $this->parseSmbclientListing($result['stdout']);

        // Download each file
        $ingestDisk = Storage::disk(config('ingest.disk'));
        $ingestDir = config('ingest.directory', 'ingest');
        $keys = [];

        foreach ($fileNames as $fileName) {
            $remoteFile = $uncPath . '/' . $fileName;
            $localKey = $ingestDir . '/' . $fileName;
            $tempPath = sys_get_temp_dir() . '/' . uniqid('ingest_', true) . '_' . $fileName;

            try {
                // Download file using smbclient
                $downloadCmd = [
                    'smbclient',
                    $uncPath,
                    '-U',
                    $user . '%' . $password,
                    '-c',
                    "get {$fileName} {$tempPath}",
                ];

                $dlResult = $this->runner->run($downloadCmd);

                if ($dlResult['exitCode'] !== 0) {
                    throw new \RuntimeException(
                        "SMB download failed for {$fileName}: {$dlResult['stderr']}"
                    );
                }

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
    }

    /**
     * Parse smbclient ls output to extract file names (lines that don't end with /).
     *
     * @return array<int, string>
     */
    private function parseSmbclientListing(string $output): array
    {
        $fileNames = [];
        $lines = explode("\n", $output);

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip empty lines and directory markers
            if (!$line || $line === '.' || $line === '..') {
                continue;
            }

            // smbclient output format (roughly): "filename   D   size   date time"
            // Directories end with '/' or ' D'
            // We skip those and extract regular files
            if (str_ends_with($line, '/')) {
                continue; // Directory
            }

            // Extract the first token (filename)
            $parts = preg_split('/\s+/', $line);
            if (!empty($parts[0]) && $parts[0] !== '.' && $parts[0] !== '..') {
                // Check if it looks like metadata (D for directory, etc.)
                // and skip if so
                if (count($parts) > 1 && $parts[1] === 'D') {
                    continue; // Directory marker
                }

                if (!empty($parts[0])) {
                    $fileNames[] = $parts[0];
                }
            }
        }

        return array_unique($fileNames);
    }
}
