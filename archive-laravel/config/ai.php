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
    ],

];
