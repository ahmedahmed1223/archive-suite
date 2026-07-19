<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LoginRateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_is_rate_limited_after_too_many_attempts(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        foreach (range(1, 30) as $attempt) {
            $this->postJson('/api/v1/auth/login', [
                'email' => 'admin@example.test',
                'password' => 'wrong-password',
            ])->assertUnauthorized();
        }

        // Even valid credentials are throttled once the limit is exhausted.
        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertStatus(429);
    }

    public function test_login_succeeds_below_the_rate_limit(): void
    {
        User::query()->create([
            'name' => 'Archive Admin',
            'email' => 'admin@example.test',
            'password' => Hash::make('secret-password'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertOk()->assertJsonPath('ok', true);
    }
}
