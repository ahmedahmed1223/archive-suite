<?php

return [
    'disk' => env('INGEST_DISK', 'local'),
    'directory' => env('INGEST_DIR', 'ingest'),
    'media_extensions' => [
        'mp4', 'mov', 'mxf', 'avi', 'mkv', 'wmv', 'flv',
        'webm', 'ts', 'm2ts', 'mts', 'dv', 'mov',
        'jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'webp',
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
