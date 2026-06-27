<?php

return [
    'api_key' => env('ARCHIVE_API_KEY'),
    'file_root' => env('ARCHIVE_FILE_ROOT', storage_path('app/archive-files')),
    'auth' => [
        'access_ttl_minutes' => (int) env('ARCHIVE_ACCESS_TTL_MINUTES', 15),
        'refresh_ttl_days' => (int) env('ARCHIVE_REFRESH_TTL_DAYS', 14),
        'refresh_cookie' => env('ARCHIVE_REFRESH_COOKIE', 'va_refresh'),
        'secure_cookies' => (bool) env('ARCHIVE_SECURE_COOKIES', false),
    ],
];
