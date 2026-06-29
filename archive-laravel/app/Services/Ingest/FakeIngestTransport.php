<?php

namespace App\Services\Ingest;

class FakeIngestTransport implements IngestTransport
{
    /**
     * ponytail: Fake transport for testing. Real FTP/SMB impls deferred.
     * When real transports needed, create FtpIngestTransport and SmbIngestTransport
     * implementing this interface; bind in AppServiceProvider based on env.
     */
    public function pull(array $params): array
    {
        // Test double: returns empty list by default.
        return [];
    }
}
