<?php

return [
    'disk' => env('INGEST_DISK', 'local'),
    'directory' => env('INGEST_DIR', 'ingest'),

    // V1-112F: organizational storage limit. Null (default) = unlimited.
    // Measured as disk usage on the ingest volume (total - free), not a
    // per-record ledger, since this deployment is single-org-per-install
    // (see docs/platform contract) — a multi-tenant install would need a
    // real per-org usage counter instead.
    'storage_quota_bytes' => env('INGEST_STORAGE_QUOTA_BYTES'),

    // V1-112F: minimum free bytes an upload must leave on the ingest disk.
    // Default 100MB is a safety margin against filling the volume, not a
    // quota. Only enforced when the ingest disk uses the 'local' driver.
    'min_free_bytes' => (int) env('INGEST_MIN_FREE_BYTES', 100 * 1024 * 1024),
    'media_extensions' => [
        'mp4', 'mov', 'mxf', 'avi', 'mkv', 'wmv', 'flv',
        'webm', 'ts', 'm2ts', 'mts', 'dv', 'mov',
        'wav', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac',
        'jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'webp',
    ],

    // V1-711: resumable chunked upload for large files. Chunk size is bounded
    // both ways — too small and a multi-GB file needs an unreasonable number
    // of requests; too large and a single chunk write approaches the same
    // memory/timeout pressure chunking exists to avoid.
    'chunk_upload' => [
        'min_chunk_bytes' => (int) env('INGEST_MIN_CHUNK_BYTES', 256 * 1024),
        'max_chunk_bytes' => (int) env('INGEST_MAX_CHUNK_BYTES', 50 * 1024 * 1024),
        'session_ttl_hours' => (int) env('INGEST_UPLOAD_SESSION_TTL_HOURS', 24),
    ],

    // Transport selection: fake (default), ftp, or smb
    'transport' => env('INGEST_TRANSPORT', 'fake'),

    // FTP transport defaults (override via env)
    'ftp' => [
        'host' => env('FTP_HOST'),
        'port' => env('FTP_PORT', 21),
        'user' => env('FTP_USER'),
        'password' => env('FTP_PASSWORD'),
        'remotePath' => env('FTP_REMOTE_PATH', '/'),
        'ssl' => env('FTP_SSL', false),
    ],

    // SMB transport defaults (override via env)
    'smb' => [
        'host' => env('SMB_HOST'),
        'share' => env('SMB_SHARE'),
        'user' => env('SMB_USER'),
        'password' => env('SMB_PASSWORD'),
        'remotePath' => env('SMB_REMOTE_PATH', '/'),
    ],
];
