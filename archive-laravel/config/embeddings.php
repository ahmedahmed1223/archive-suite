<?php

return [

    /*
    |--------------------------------------------------------------------------
    | pgvector Semantic Search
    |--------------------------------------------------------------------------
    |
    | Off by default. Requires Postgres + the `vector` extension — on any
    | other driver (e.g. sqlite in tests) EmbeddingService::isEnabled()
    | always returns false and semantic search degrades to keyword search.
    |
    */

    'enabled' => env('EMBEDDINGS_ENABLED', false),

    'provider' => env('EMBEDDINGS_PROVIDER', 'openai'),

    'model' => env('EMBEDDINGS_MODEL', 'text-embedding-3-small'),

    'dimensions' => (int) env('EMBEDDINGS_DIMENSIONS', 1536),

    // Reuses OPENAI_API_KEY so the AI copilot and embeddings share one secret.
    'api_key' => env('OPENAI_API_KEY'),

    // Override for OpenAI-compatible endpoints (OpenRouter, local proxies, etc).
    'base_url' => env('EMBEDDINGS_BASE_URL', 'https://api.openai.com/v1'),

];
