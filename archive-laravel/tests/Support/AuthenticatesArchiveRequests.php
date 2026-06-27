<?php

namespace Tests\Support;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

trait AuthenticatesArchiveRequests
{
    private ?string $archiveAccessToken = null;

    /**
     * @return array<string, string>
     */
    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->archiveAccessToken()];
    }

    private function archiveAccessToken(): string
    {
        if ($this->archiveAccessToken) {
            return $this->archiveAccessToken;
        }

        User::query()->firstOrCreate(
            ['email' => 'admin@example.test'],
            [
                'name' => 'Archive Admin',
                'password' => Hash::make('secret-password'),
            ],
        );

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@example.test',
            'password' => 'secret-password',
        ])->assertOk();

        $token = $response->json('accessToken');
        $this->assertIsString($token);

        return $this->archiveAccessToken = $token;
    }
}
