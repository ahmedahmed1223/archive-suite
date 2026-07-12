<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * V1-102: named Gate abilities backing Controller::requireAdmin()/requireEditor().
 *
 * The three existing `role` values (admin/editor/viewer, see UsersController::ROLES)
 * already model everything this pass needs — no new permission system, just real
 * Illuminate\Auth\Access\Gate checks instead of ad-hoc `$user->role === 'admin'`
 * string comparisons scattered across controllers.
 */
class AuthServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::define('manage-system', fn (User $user): bool => $user->role === 'admin');

        Gate::define('manage-content', fn (User $user): bool => in_array($user->role, ['admin', 'editor'], true));
    }
}
