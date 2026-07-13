<?php

return [
    'file_root' => env('ARCHIVE_FILE_ROOT', storage_path('app/archive-files')),
    'backup_path' => env('ARCHIVE_BACKUP_PATH', storage_path('app/backups')),

    // Highest-risk surface: host control actions (clear cache, trigger backup,
    // ...) are a no-op unless this is explicitly true. Checked server-side in
    // SystemControlService, not just hidden in the UI.
    'system_control_enabled' => (bool) env('SYSTEM_CONTROL_ENABLED', false),

    // Broadcast metadata (MOS/MXF) requires an external integration endpoint.
    // Absent config means the surface reports "configuration required" instead
    // of a broken or empty state.
    'broadcast' => [
        'mos_endpoint' => env('MOS_ENDPOINT'),
        'mxf_endpoint' => env('MXF_ENDPOINT'),
    ],
    'auth' => [
        'access_ttl_minutes' => (int) env('ARCHIVE_ACCESS_TTL_MINUTES', 15),
        'refresh_ttl_days' => (int) env('ARCHIVE_REFRESH_TTL_DAYS', 14),
        'refresh_cookie' => env('ARCHIVE_REFRESH_COOKIE', 'va_refresh'),
        'secure_cookies' => (bool) env('ARCHIVE_SECURE_COOKIES', false),
    ],

    // Backup hardening: checksums, encryption, retention, DR drills
    'backups' => [
        'encryption_enabled' => (bool) env('BACKUP_ENCRYPTION_ENABLED', false),
        'max_count' => (int) env('BACKUP_MAX_COUNT', 30),
        'max_age_days' => (int) env('BACKUP_MAX_AGE_DAYS', 90),
    ],

    // V1-123: audit log retention. audit:prune deletes rows older than this;
    // kept generous by default since audit_logs is the compliance trail, not
    // operational noise.
    'audit_log_retention_days' => (int) env('AUDIT_LOG_RETENTION_DAYS', 365),

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
