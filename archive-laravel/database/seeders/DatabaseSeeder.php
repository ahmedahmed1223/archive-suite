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
        // firstOrCreate: safe to run on every deploy/restart, never duplicates.
        User::query()->firstOrCreate(
            ['email' => env('ADMIN_EMAIL', 'test@example.com')],
            [
                'name' => env('ADMIN_NAME', 'Archive Admin'),
                'password' => env('ADMIN_PASSWORD', 'password'),
            ],
        );

        // Opt-in demo archive content (types/sections/classifications + records).
        // Off by default to keep production clean; enable with SEED_DEMO_DATA=true
        // or run directly: `php artisan db:seed --class=DemoArchiveSeeder`.
        if (filter_var(env('SEED_DEMO_DATA', false), FILTER_VALIDATE_BOOL)) {
            $this->call(DemoArchiveSeeder::class);
        }
    }
}
