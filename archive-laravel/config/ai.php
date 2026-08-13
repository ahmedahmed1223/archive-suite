<?php

return [

    'default' => 'openrouter',
    'default_for_images' => 'openrouter',
    'default_for_audio' => 'openrouter',
    'default_for_transcription' => 'openrouter',
    'default_for_embeddings' => 'openrouter',

    'caching' => [
        'embeddings' => [
            'cache' => false,
            'store' => env('CACHE_STORE', 'database'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | AI Providers
    |--------------------------------------------------------------------------
    |
    | AI-801: OpenRouter is the one explicitly configured provider for this
    | rollout - a single unified key read here, never exposed to
    | archive-next (this file is server-only Laravel config, not part of
    | the public API contract). Add another provider only when a concrete
    | need lands.
    |
    */

    'providers' => [
        'openrouter' => [
            'driver' => 'openrouter',
            'key' => env('OPENROUTER_API_KEY'),
        ],
        // A separate named provider makes the fallback chain explicit and
        // auditable while it continues to use the same server-only key.
        'openrouter_backup' => [
            'driver' => 'openrouter',
            'key' => env('OPENROUTER_API_KEY'),
        ],
    ],

    'governance' => [
        'failover' => [
            'openrouter' => env('OPENROUTER_MODEL', 'openai/gpt-4.1-mini'),
            'openrouter_backup' => env('OPENROUTER_BACKUP_MODEL', 'google/gemini-2.5-flash'),
        ],
        'limits' => [
            'user_requests_per_hour' => env('AI_USER_REQUESTS_PER_HOUR', 30),
            'department_requests_per_day' => env('AI_DEPARTMENT_REQUESTS_PER_DAY', 500),
            'user_daily_cents' => env('AI_USER_DAILY_CENTS', 500),
            'department_daily_cents' => env('AI_DEPARTMENT_DAILY_CENTS', 5000),
            'max_output_tokens' => env('AI_MAX_OUTPUT_TOKENS', 800),
            'input_cents_per_1k' => env('AI_INPUT_CENTS_PER_1K', 1),
            'output_cents_per_1k' => env('AI_OUTPUT_CENTS_PER_1K', 2),
        ],
    ],

];
