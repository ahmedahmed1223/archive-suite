<?php

namespace App\Services\Uploads;

use App\Exceptions\ScheduledUploadConflict;
use App\Models\ScheduledUpload;

class ScheduledUploadState
{
    /**
     * Legal state transitions: from -> [to, to, ...]
     *
     * @var array<string, list<string>>
     */
    public const LEGAL = [
        // 'scheduled' => 'scheduled' is a self-loop: Task 3's reschedule
        // endpoint reuses this same atomic version-checked update to change
        // scheduled_at/time_zone without a status change.
        'scheduled' => ['scheduled', 'claimed', 'cancelled'],
        // 'claimed' => 'scheduled' (Task 4): releases a claim back to the
        // pool in two cases -- the dispatcher claimed a row but failed to
        // push its job onto the queue (transient queue-connection failure),
        // or the recovery watchdog finds a claim whose lease expired
        // without the worker ever finishing (crashed/lost process). Both are
        // "give this row back, someone will pick it up next cycle", not a
        // processing outcome, so it belongs on 'claimed', not 'processing'.
        'claimed' => ['processing', 'cancelled', 'scheduled'],
        'processing' => ['completed', 'failed'],
        'completed' => [],
        'cancelled' => [],
        // 'failed' => 'scheduled' lets Task 3's retry endpoint requeue an
        // infrastructure-failure row through the same atomic transition.
        'failed' => ['scheduled'],
    ];

    /**
     * Attempt an atomic optimistic-lock state transition.
     *
     * @param string $id           ScheduledUpload ID (UUID)
     * @param string $from         Expected current status
     * @param string $to           Desired new status
     * @param int    $version      Expected current version
     * @param array  $changes      Additional columns to update (e.g., ['lease_expires_at' => now()->addHour()])
     *
     * @throws ScheduledUploadConflict if the transition is illegal or the record changed concurrently
     *
     * @return ScheduledUpload the updated model
     */
    public function transition(string $id, string $from, string $to, int $version, array $changes = []): ScheduledUpload
    {
        if (! in_array($to, self::LEGAL[$from] ?? [], true)) {
            throw ScheduledUploadConflict::illegalTransition($from, $to);
        }
        $changed = ScheduledUpload::query()->whereKey($id)->where('status', $from)->where('version', $version)
            ->update([...$changes, 'status' => $to, 'version' => $version + 1, 'updated_at' => now()]);
        if ($changed !== 1) throw ScheduledUploadConflict::staleVersion();
        return ScheduledUpload::query()->findOrFail($id);
    }
}
