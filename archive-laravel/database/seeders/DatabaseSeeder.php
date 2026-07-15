<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $isProduction = app()->environment('production');

        // No convenience defaults in production — an unset ADMIN_EMAIL/ADMIN_PASSWORD
        // must fail loudly rather than silently seed a guessable admin account.
        $adminEmail = env('ADMIN_EMAIL', $isProduction ? null : 'test@example.com');
        $adminPassword = env('ADMIN_PASSWORD', $isProduction ? null : 'password');

        if ($isProduction) {
            $this->assertStrongAdminCredentials($adminEmail, $adminPassword);
        }

        // firstOrCreate: safe to run on every deploy/restart, never duplicates.
        $admin = User::query()->firstOrCreate(
            ['email' => $adminEmail],
            [
                'name' => env('ADMIN_NAME', 'Archive Admin'),
                'password' => $adminPassword,
                'role' => 'admin',
            ],
        );

        if ($admin->role !== 'admin') {
            $admin->forceFill(['role' => 'admin'])->save();
        }

        // Opt-in demo archive content (types/sections/classifications + records).
        // Off by default to keep production clean; enable with SEED_DEMO_DATA=true
        // or run directly: `php artisan db:seed --class=DemoArchiveSeeder`.
        if (filter_var(env('SEED_DEMO_DATA', false), FILTER_VALIDATE_BOOL)) {
            $this->call(DemoArchiveSeeder::class);
        }
    }

    /**
     * V1-101: refuse to seed a default/weak admin account in production.
     *
     * ponytail: weak-list ceiling is a fixed literal set + CHANGE_ME substring +
     * 12-char minimum, mirrors scripts/control-center.mjs's isPlaceholder()/
     * MIN_ADMIN_PASSWORD_LENGTH so backend and Control Center agree on what
     * counts as a placeholder. Extend both places together if the list grows.
     */
    private function assertStrongAdminCredentials(?string $email, ?string $password): void
    {
        if (empty($email) || strtolower($email) === 'test@example.com') {
            throw new \RuntimeException(
                'ADMIN_EMAIL is unset or the default test@example.com. Set ADMIN_EMAIL to a '
                . 'real address before seeding in production.'
            );
        }

        $weakLiterals = ['password', 'secret', 'admin', 'changeme'];

        if (
            empty($password)
            || strlen($password) < 12
            || str_contains(strtoupper($password), 'CHANGE_ME')
            || in_array(strtolower($password), $weakLiterals, true)
        ) {
            throw new \RuntimeException(
                'ADMIN_PASSWORD is unset or too weak for production. Set a strong, unique '
                . 'ADMIN_PASSWORD (12+ characters, not a placeholder like "CHANGE_ME..." or '
                . '"password") in your environment before seeding.'
            );
        }
    }
}
