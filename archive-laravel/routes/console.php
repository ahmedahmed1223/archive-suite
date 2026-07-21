<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schedule;

// V1-123: retention/pruning schedule. Each command is independently safe to
// run daily — see the command classes in app/Console/Commands for the
// per-domain retention window and what's excluded (queued/processing media
// jobs, the most-recent backup regardless of age).
Schedule::command('sessions:prune')->daily();
Schedule::command('audit:prune')->daily();
// V1-734: catches tampering with the audit trail (edited/deleted rows) even
// if nobody happens to run the check by hand.
Schedule::command('audit:verify-chain')->daily();
// V1-733: catches silent file corruption/deletion outside the app by
// re-checksumming stored attachments against what was recorded at upload.
Schedule::command('files:verify-integrity')->daily();
Schedule::command('media:prune-jobs')->daily();
Schedule::command('backup:cleanup')->daily();
Schedule::command('trash:prune')->daily();
// V1-756: hourly is the resolution the storage forecast needs; the daily
// prune is what keeps an append-only sampler from growing without bound.
Schedule::command('metrics:capture')->hourly();
Schedule::command('metrics:prune')->daily();

// V1-712 Task 4: durable scheduled uploads -- dispatch claims due rows every
// minute, recover releases claims whose lease expired without the worker
// finishing, cleanup prunes terminal rows past their retention window.
Schedule::command('uploads:dispatch-scheduled')->everyMinute()->withoutOverlapping();
Schedule::command('uploads:recover-scheduled')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('uploads:cleanup-scheduled')->hourly()->withoutOverlapping();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('archive:admin-password {--email=} {--password=}', function (): int {
    $email = trim((string) ($this->option('email') ?: env('ADMIN_EMAIL', 'admin@example.com')));
    $password = (string) ($this->option('password') ?: trim(stream_get_contents(STDIN)));

    if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $this->error('A valid --email value is required.');

        return 1;
    }

    if (strlen($password) < 12) {
        $this->error('Password must be at least 12 characters.');

        return 1;
    }

    $user = User::query()->where('email', $email)->first();
    if (! $user) {
        $this->error("No user found for {$email}.");

        return 1;
    }

    $user->forceFill(['password' => Hash::make($password)])->save();
    $this->info("Updated admin password for {$email}.");

    return 0;
})->purpose('Update the password for an existing Masar admin user');
