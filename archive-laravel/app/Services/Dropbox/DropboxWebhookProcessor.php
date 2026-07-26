<?php

declare(strict_types=1);

namespace App\Services\Dropbox;

use Illuminate\Support\Facades\DB;

class DropboxWebhookProcessor
{
    public function accept(string $eventId, array $payload): bool
    {
        try {
            DB::table('dropbox_webhook_deliveries')->insert(['event_id' => $eventId, 'payload' => json_encode($payload), 'processed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
            return true;
        } catch (\Illuminate\Database\UniqueConstraintViolationException) { return false; }
    }
    public function deadLetter(string $eventId, array $payload, \Throwable $error): void
    {
        DB::table('dropbox_dead_letters')->insert(['event_id' => $eventId, 'payload' => json_encode($payload), 'last_error' => $error->getMessage(), 'attempts' => 1, 'retry_after' => now()->addMinutes(5), 'created_at' => now(), 'updated_at' => now()]);
    }
}
