<?php

namespace App\Services\Ingest;

interface IngestTransport
{
    /**
     * Pull files from a remote source (FTP, SMB, etc.).
     *
     * @param array<string, mixed> $params Connection and path parameters
     * @return array<int, string> List of pulled file paths
     */
    public function pull(array $params): array;
}
