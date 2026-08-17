<?php

declare(strict_types=1);

return [
    // V3-PERF-002: single source of truth for "slow" so CorrelateRequest
    // (HTTP) and ProcessMediaWorkflow (queue) don't each hardcode their own
    // duplicate literal.
    'slow_request_threshold_ms' => (int) env('SLOW_REQUEST_THRESHOLD_MS', 1000),
    'slow_queue_wait_threshold_ms' => (int) env('SLOW_QUEUE_WAIT_THRESHOLD_MS', 5000),
];
