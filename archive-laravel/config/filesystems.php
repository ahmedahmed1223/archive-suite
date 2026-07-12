<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // AWS_ENDPOINT + AWS_USE_PATH_STYLE_ENDPOINT also cover S3-compatible
        // services (Cloudflare R2, DigitalOcean Spaces, MinIO, Backblaze B2) —
        // point AWS_ENDPOINT at the provider and set AWS_USE_PATH_STYLE_ENDPOINT=true
        // where required. No separate disk/driver needed for these.
        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

        'azure' => [
            'driver' => 'azure',
            'connection_string' => env('AZURE_STORAGE_CONNECTION_STRING'),
            'container' => env('AZURE_STORAGE_CONTAINER'),
            'prefix' => env('AZURE_STORAGE_PREFIX', ''),
            'throw' => false,
            'report' => false,
        ],

        'gcs' => [
            'driver' => 'gcs',
            // Nullable: when empty, the Google SDK falls back to Application
            // Default Credentials (ADC).
            'key_file' => env('GOOGLE_CLOUD_KEY_FILE'),
            'project_id' => env('GOOGLE_CLOUD_PROJECT_ID'),
            'bucket' => env('GOOGLE_CLOUD_STORAGE_BUCKET'),
            'prefix' => env('GOOGLE_CLOUD_STORAGE_PREFIX', ''),
            'throw' => false,
            'report' => false,
        ],

        'dropbox' => [
            'driver' => 'dropbox',
            'token' => env('DROPBOX_ACCESS_TOKEN'),
            'prefix' => env('DROPBOX_PREFIX', ''),
            'throw' => false,
            'report' => false,
        ],

        // Native Laravel driver (league/flysystem-sftp-v3) — no Storage::extend needed.
        'sftp' => [
            'driver' => 'sftp',
            'host' => env('SFTP_HOST'),
            'port' => (int) env('SFTP_PORT', 22),
            'username' => env('SFTP_USERNAME'),
            'password' => env('SFTP_PASSWORD'),
            'privateKey' => env('SFTP_PRIVATE_KEY'),
            'root' => env('SFTP_ROOT', ''),
            'throw' => false,
            'report' => false,
        ],

        // Native Laravel driver (league/flysystem-ftp) — no Storage::extend needed.
        'ftp' => [
            'driver' => 'ftp',
            'host' => env('FTP_HOST'),
            'port' => (int) env('FTP_PORT', 21),
            'username' => env('FTP_USERNAME'),
            'password' => env('FTP_PASSWORD'),
            'root' => env('FTP_ROOT', ''),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
