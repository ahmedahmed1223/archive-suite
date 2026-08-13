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

    // V2-203: embeddings:sync used to loop over an entire store issuing one
    // paid API call per changed row with no ceiling and no pacing. These cap
    // spend per invocation and space out calls; --limit/--rate-limit on the
    // command override them per run.
    'sync_max_calls_per_run' => (int) env('EMBEDDINGS_SYNC_MAX_CALLS_PER_RUN', 1000),
    'sync_rate_limit_per_minute' => (int) env('EMBEDDINGS_SYNC_RATE_LIMIT_PER_MINUTE', 60),

];
