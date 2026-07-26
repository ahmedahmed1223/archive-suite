<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DropboxIntegrationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        User::query()->create(['name' => 'Admin', 'email' => 'dropbox-admin@example.test', 'password' => Hash::make('password'), 'role' => 'admin']);
    }

    public function test_status_is_disabled_without_oauth_credentials(): void
    {
        config()->set('services.dropbox.client_id', null);
        config()->set('services.dropbox.client_secret', null);
        $token = $this->loginAsAdmin();

        $this->getJson('/api/v1/system/dropbox', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('dropbox.status', 'disabled');
    }

    public function test_connection_tokens_are_encrypted_at_rest_and_disconnectable(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        $token = $this->loginAsAdmin();
        $secret = 'dropbox-access-token-that-must-not-be-plain';

        $this->postJson('/api/v1/system/dropbox/connect', [
            'accessToken' => $secret,
            'refreshToken' => 'refresh-token',
            'folderPath' => '/Archive',
        ], ['Authorization' => 'Bearer '.$token])
            ->assertCreated()
            ->assertJsonPath('dropbox.status', 'connected');

        $row = \DB::table('dropbox_connections')->first();
        $this->assertNotNull($row);
        $this->assertStringNotContainsString($secret, $row->encrypted_access_token);

        $this->deleteJson('/api/v1/system/dropbox', [], ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('dropbox.status', 'disconnected');
    }

    private function loginAsAdmin(): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => 'dropbox-admin@example.test', 'password' => 'password'])->json('accessToken');
    }
}
