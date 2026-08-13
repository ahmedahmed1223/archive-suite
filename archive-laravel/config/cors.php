<?php

// V2-404: archive.security.cors_origins was exposed via SecuritySettingsService
// and displayed in the settings UI as if it were enforced, but no config/cors.php
// ever existed for Laravel's HandleCors middleware to read -- CORS was never
// actually applied to any route. This makes that same origin list the real
// source of truth for the framework's CORS handling.
return [
    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => config('archive.security.cors_origins', []),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
