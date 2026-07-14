<?php

declare(strict_types=1);

namespace App\Console\Commands\Concerns;

/**
 * V1-208H: shared {ok, code, message, details} envelope for the
 * archive:backup-* commands, matching the shape scripts/control-center
 * already speaks (setup-config.mjs's success()/failure() helpers) so the
 * Node side can parse either side of the process boundary the same way.
 *
 * With --json, the envelope is the ONLY thing written to stdout (one line);
 * without it, only a short human message goes through $this->components.
 */
trait EmitsBackupResult
{
    /**
     * Named emitSuccess/emitFailure rather than succeed/fail: Illuminate\Console\Command
     * already declares a public fail() method, and a trait's private member
     * can't narrow an inherited method's visibility — composer's
     * package:discover (which boots every command class) fails hard on that.
     *
     * @param  array<string, mixed>  $details
     */
    private function emitSuccess(bool $json, string $code, string $message, array $details = []): int
    {
        if ($json) {
            $this->line(json_encode(['ok' => true, 'code' => $code, 'message' => $message, 'details' => $details], JSON_THROW_ON_ERROR));
        } else {
            $this->components->info($message);
        }

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $details
     */
    private function emitFailure(bool $json, string $code, string $message, array $details = []): int
    {
        if ($json) {
            $this->line(json_encode(['ok' => false, 'code' => $code, 'message' => $message, 'details' => $details], JSON_THROW_ON_ERROR));
        } else {
            $this->components->error($message);
        }

        return self::FAILURE;
    }
}
