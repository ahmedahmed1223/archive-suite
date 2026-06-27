<?php

return [
    'api_key' => env('ARCHIVE_API_KEY'),
    'file_root' => env('ARCHIVE_FILE_ROOT', storage_path('app/archive-files')),
];
