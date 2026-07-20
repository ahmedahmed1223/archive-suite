<?php

return [
    // Queue name for scheduled upload jobs.
    'queue' => env('SCHEDULED_UPLOADS_QUEUE', 'scheduled-uploads'),

    // Batch size: process this many scheduled uploads per job dispatch.
    'batch' => (int) env('SCHEDULED_UPLOADS_BATCH', 100),

    // Lease duration in seconds: how long a claimed upload holds the lease.
    'lease_seconds' => (int) env('SCHEDULED_UPLOADS_LEASE_SECONDS', 1800),

    // Maximum retry attempts before marking as failed.
    'tries' => (int) env('SCHEDULED_UPLOADS_TRIES', 5),

    // How long to keep cancelled scheduled_uploads rows before pruning (hours).
    'cancelled_retention_hours' => (int) env('SCHEDULED_UPLOADS_CANCELLED_RETENTION_HOURS', 24),

    // How long to keep failed scheduled_uploads rows before pruning (hours).
    'failed_retention_hours' => (int) env('SCHEDULED_UPLOADS_FAILED_RETENTION_HOURS', 168),

    // Ceiling on the queue depth: if this many uploads are queued, defer new dispatches.
    'dispatch_queue_depth_ceiling' => (int) env('SCHEDULED_UPLOADS_QUEUE_DEPTH_CEILING', 5000),

    // V1-712 Task 8: /api/v1/health reports the scheduler as stale once its
    // last heartbeat is older than this (the plan's "two minutes").
    'health_fresh_after_seconds' => (int) env('SCHEDULED_UPLOADS_HEALTH_FRESH_SECONDS', 120),

    // V1-712 Task 8: /api/v1/health reports degraded once the oldest overdue
    // scheduled upload has been waiting longer than this.
    'health_oldest_due_threshold_seconds' => (int) env('SCHEDULED_UPLOADS_HEALTH_OLDEST_DUE_SECONDS', 300),
];
