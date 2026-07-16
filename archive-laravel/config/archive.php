<?php

return [
    // Media workers must use the same local root as the default ingest disk.
    // Otherwise uploaded files land in storage/app/private while ffmpeg looks
    // in storage/app/archive-files and every derived-media job fails.
    'file_root' => env('ARCHIVE_FILE_ROOT', storage_path('app/private')),
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
        'session_cookie' => env('ARCHIVE_SESSION_COOKIE', 'va_session'),
        'secure_cookies' => (bool) env('ARCHIVE_SECURE_COOKIES', false),
    ],

    // Backup hardening: checksums, encryption, retention, DR drills
    'backups' => [
        'encryption_enabled' => (bool) env('BACKUP_ENCRYPTION_ENABLED', false),
        'max_count' => (int) env('BACKUP_MAX_COUNT', 30),
        'max_age_days' => (int) env('BACKUP_MAX_AGE_DAYS', 90),
    ],

    // V1-203: optional bypass secret for `php artisan down` during
    // archive:migrate-safe. Unset means no secret URL is issued.
    'migration_maintenance_secret' => env('ARCHIVE_MIGRATION_SECRET'),

    // V1-123: audit log retention. audit:prune deletes rows older than this;
    // kept generous by default since audit_logs is the compliance trail, not
    // operational noise.
    'audit_log_retention_days' => (int) env('AUDIT_LOG_RETENTION_DAYS', 365),

    // V1-756: storage sample retention. metrics:capture appends hourly, so
    // metrics:prune is what bounds the table. 90 days is long enough to fit a
    // seasonal growth trend and short enough to stay cheap (~2k rows).
    'metric_sample_retention_days' => (int) env('METRIC_SAMPLE_RETENTION_DAYS', 90),

    // V1-731: trash retention. trash:prune permanently deletes trashed_records
    // entries older than this. 30 days is an undo window, not an archive — the
    // record is already out of storage_rows, and backups (not this table) are
    // the long-term recovery story.
    'trash_retention_days' => (int) env('TRASH_RETENTION_DAYS', 30),

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

    // V1-001: scope-lock feature flags for experimental/hidden route groups
    // (see docs/scope/v1-route-scope.md). Default true in local/testing so
    // the existing test suite keeps passing without every test opting in;
    // false everywhere else (staging/production) until explicitly enabled.
    //
    // NOTE: use env('APP_ENV') here, not app()->environment() — config files
    // are loaded by LoadConfiguration::bootstrap() *before* it calls
    // $app->detectEnvironment(), so $app['env'] isn't bound yet at this
    // point and app()->environment() throws "Target class [env] does not
    // exist." (confirmed by booting the kernel directly; see git history
    // for the reproduction). config/app.php's own 'env' key has the same
    // constraint and uses env('APP_ENV', ...) for the same reason.
    'features' => [
        // Generic external-database (ODBC) read/write proxy. No RBAC gate
        // (any authenticated user can hit an allowlisted table) and depends
        // on an external DSN most deployments never configure.
        'odbc' => (bool) env('ARCHIVE_FEATURE_ODBC', in_array(env('APP_ENV', 'production'), ['local', 'testing'], true)),
        // MOS/MXF broadcast-industry metadata on archive records. Already
        // degrades gracefully when unconfigured; niche enough to keep flagged.
        'broadcast_metadata' => (bool) env('ARCHIVE_FEATURE_BROADCAST_METADATA', in_array(env('APP_ENV', 'production'), ['local', 'testing'], true)),
    ],
];
