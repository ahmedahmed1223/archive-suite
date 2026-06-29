<?php

return [
    'disk' => env('INGEST_DISK', 'local'),
    'directory' => env('INGEST_DIR', 'ingest'),
    'media_extensions' => [
        'mp4', 'mov', 'mxf', 'avi', 'mkv', 'wmv', 'flv',
        'webm', 'ts', 'm2ts', 'mts', 'dv', 'mov',
        'jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'webp',
    ],
];
