<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\ApiSession;
use Illuminate\Console\Command;

/**
 * V1-123: retention for api_sessions — the table that actually backs auth
 * (bearer access token + va_refresh cookie, see AuthController /
 * AuthenticateArchiveApiRequest). Laravel's own "sessions" table
 * (config/session.php, database driver) is present only as unused framework
 * scaffolding — this app has no 'web' session middleware usage, so nothing
 * ever writes rows there worth pruning.
 *
 * A row is prunable once refresh_expires_at has passed: at that point it
 * can no longer refresh (AuthController::refresh() requires
 * refresh_expires_at > now()) and is dead weight, not a live session.
 */
class SessionsPruneCommand extends Command
{
    protected $signature = 'sessions:prune';

    protected $description = 'Delete api_sessions rows whose refresh window has fully expired';

    public function handle(): int
    {
        $deleted = ApiSession::query()->where('refresh_expires_at', '<', now())->delete();

        $this->info("Pruned {$deleted} expired session(s).");

        return 0;
    }
}
