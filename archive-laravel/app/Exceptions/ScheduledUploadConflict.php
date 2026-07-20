<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a ScheduledUpload state transition fails due to a stale
 * version number or an illegal transition. Use the named constructors so
 * callers can distinguish a caller bug (illegal transition) from a
 * legitimate race (stale version) via the `reason` property.
 */
class ScheduledUploadConflict extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $reason,
    ) {
        parent::__construct($message);
    }

    public static function illegalTransition(string $from, string $to): self
    {
        return new self("Illegal scheduled upload transition from [{$from}] to [{$to}].", 'illegal_transition');
    }

    public static function staleVersion(): self
    {
        return new self('Scheduled upload changed concurrently.', 'stale_version');
    }
}
