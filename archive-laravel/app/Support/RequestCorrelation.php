<?php

declare(strict_types=1);

namespace App\Support;

/**
 * V3-PERF-002: one place to read the current request's correlation id
 * (set by CorrelateRequest onto request attributes) so job-dispatch call
 * sites don't each re-implement the "is there even a request?" check.
 * Returns null outside an HTTP request (console, scheduled command).
 */
final class RequestCorrelation
{
    public static function id(): ?string
    {
        if (! app()->bound('request')) {
            return null;
        }

        $value = request()->attributes->get('request_id');

        return is_string($value) && $value !== '' ? $value : null;
    }
}
