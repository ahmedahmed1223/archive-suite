<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\User;
use App\Services\Dropbox\DropboxSyncService;
use App\Services\Dropbox\DropboxWebhookProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * V1-762: a signed Dropbox webhook only says "something changed" — this job
 * turns that into an actual incremental sync for every connected account,
 * and routes a failed sync to the dead-letter table instead of losing the
 * event silently.
 */
class ProcessDropboxWebhook implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public readonly string $eventId,
        public readonly array $payload,
    ) {}

    public function handle(DropboxSyncService $sync, DropboxWebhookProcessor $processor): void
    {
        $connections = DB::table('dropbox_connections')->where('status', 'connected')->get();

        foreach ($connections as $connection) {
            $user = User::find($connection->user_id);

            if (! $user) {
                continue;
            }

            try {
                $sync->import($user);
            } catch (Throwable $e) {
                $processor->deadLetter($this->eventId, $this->payload, $e);
            }
        }
    }
}
