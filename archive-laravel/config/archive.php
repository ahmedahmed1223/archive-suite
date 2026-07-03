<?php

return [
    'file_root' => env('ARCHIVE_FILE_ROOT', storage_path('app/archive-files')),
    'backup_path' => env('ARCHIVE_BACKUP_PATH', storage_path('app/backups')),
    'auth' => [
        'access_ttl_minutes' => (int) env('ARCHIVE_ACCESS_TTL_MINUTES', 15),
        'refresh_ttl_days' => (int) env('ARCHIVE_REFRESH_TTL_DAYS', 14),
        'refresh_cookie' => env('ARCHIVE_REFRESH_COOKIE', 'va_refresh'),
        'secure_cookies' => (bool) env('ARCHIVE_SECURE_COOKIES', false),
    ],

    // Defaults for the security settings panel. The safe subset (rate limit,
    // legacy password upgrade) can be overridden at runtime and persisted; CSP
    // and CORS are deploy-time only (read-only in the API).
    'security' => [
        'rate_limit_per_minute' => (int) env('ARCHIVE_RATE_LIMIT_PER_MINUTE', 60),
        'legacy_password_upgrade' => (bool) env('ARCHIVE_LEGACY_PASSWORD_UPGRADE', false),
        'csp_policy' => env('ARCHIVE_CSP_POLICY', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"),
        'cors_origins' => array_values(array_filter(
            array_map('trim', explode(',', env('ARCHIVE_CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173')))
        )),
    ],
];
