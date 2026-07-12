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
                // V1-102: this trait is shared by tests that use the token purely
                // to act as a normal working user (seeding fixtures via bulk
                // upsert, creating shares, etc.), not to test role restrictions.
                // Default role is viewer (read-only); use editor here so those
                // write calls keep succeeding under requireEditor() gates.
                'role' => 'editor',
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
