<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
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

    public function test_authorize_returns_pkce_url_without_exposing_verifier(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        config()->set('services.dropbox.redirect_uri', 'https://archive.example.test/callback');
        $response = $this->postJson('/api/v1/system/dropbox/authorize', [], ['Authorization' => 'Bearer '.$this->loginAsAdmin()]);
        $response->assertOk()->assertJsonPath('ok', true);
        $this->assertStringContainsString('code_challenge_method=S256', $response->json('authorizationUrl'));
        $this->assertStringNotContainsString('code_verifier', $response->json('authorizationUrl'));
    }

    public function test_signed_webhook_is_idempotent(): void
    {
        config()->set('services.dropbox.webhook_secret', 'webhook-secret');
        $body = json_encode(['list_folder' => ['accounts' => ['dbid:account']]]);
        $signature = hash_hmac('sha256', $body, 'webhook-secret');
        $this->call('POST', '/api/v1/integrations/dropbox/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_DROPBOX_SIGNATURE' => $signature], $body)->assertOk()->assertJsonPath('accepted', true);
        $this->call('POST', '/api/v1/integrations/dropbox/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_DROPBOX_SIGNATURE' => $signature], $body)->assertOk()->assertJsonPath('accepted', false);
    }

    public function test_sync_refreshes_an_expired_access_token_before_calling_dropbox(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        $token = $this->loginAsAdmin();

        $this->postJson('/api/v1/system/dropbox/connect', [
            'accessToken' => 'stale-access-token',
            'refreshToken' => 'refresh-token',
            'folderPath' => '/Archive',
            'expiresAt' => now()->subMinute()->toIso8601String(),
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        Http::fake([
            'api.dropboxapi.com/oauth2/token' => Http::response(['access_token' => 'fresh-access-token', 'expires_in' => 14400]),
            'api.dropboxapi.com/2/files/list_folder' => Http::response(['entries' => [], 'cursor' => 'cursor-1', 'has_more' => false]),
        ]);

        $this->postJson('/api/v1/system/dropbox/sync', [], ['Authorization' => 'Bearer '.$token])->assertOk()->assertJsonPath('ok', true);

        $row = \DB::table('dropbox_connections')->first();
        $this->assertStringNotContainsString('stale-access-token', $row->encrypted_access_token);
        Http::assertSent(fn ($request) => $request->url() === 'https://api.dropboxapi.com/2/files/list_folder' && $request->header('Authorization')[0] === 'Bearer fresh-access-token');
    }

    public function test_sync_retries_a_rate_limited_list_folder_call(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        $token = $this->loginAsAdmin();

        $this->postJson('/api/v1/system/dropbox/connect', [
            'accessToken' => 'access-token',
            'folderPath' => '/Archive',
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        Http::fake([
            'api.dropboxapi.com/2/files/list_folder' => Http::sequence()
                ->push(['error_summary' => 'too_many_requests'], 429)
                ->push(['entries' => [], 'cursor' => 'cursor-1', 'has_more' => false], 200),
        ]);

        $this->postJson('/api/v1/system/dropbox/sync', [], ['Authorization' => 'Bearer '.$token])
            ->assertOk()->assertJsonPath('ok', true)->assertJsonPath('sync.cursor', 'cursor-1');
    }

    public function test_accepted_webhook_dispatches_sync_and_dead_letters_on_failure(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        config()->set('services.dropbox.webhook_secret', 'webhook-secret');
        $token = $this->loginAsAdmin();

        $this->postJson('/api/v1/system/dropbox/connect', [
            'accessToken' => 'access-token',
            'folderPath' => '/Archive',
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        Http::fake(['api.dropboxapi.com/2/files/list_folder' => Http::response(['error_summary' => 'internal'], 500)]);

        $body = json_encode(['list_folder' => ['accounts' => ['dbid:account']]]);
        $signature = hash_hmac('sha256', $body, 'webhook-secret');
        $this->call('POST', '/api/v1/integrations/dropbox/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_DROPBOX_SIGNATURE' => $signature], $body)
            ->assertOk()->assertJsonPath('accepted', true);

        $deadLetter = \DB::table('dropbox_dead_letters')->first();
        $this->assertNotNull($deadLetter);
        $this->assertSame(hash('sha256', $body), $deadLetter->event_id);
    }

    public function test_browse_folders_lists_only_folders_at_the_given_path(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        $token = $this->loginAsAdmin();

        $this->postJson('/api/v1/system/dropbox/connect', [
            'accessToken' => 'access-token',
            'folderPath' => '/Archive',
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        Http::fake(['api.dropboxapi.com/2/files/list_folder' => Http::response(['entries' => [
            ['.tag' => 'folder', 'name' => '2026', 'path_display' => '/Archive/2026', 'path_lower' => '/archive/2026'],
            ['.tag' => 'file', 'name' => 'notes.txt', 'path_display' => '/Archive/notes.txt', 'path_lower' => '/archive/notes.txt'],
        ], 'cursor' => 'cursor-1', 'has_more' => false])]);

        $this->getJson('/api/v1/system/dropbox/folders?path=/Archive', ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonCount(1, 'folders')
            ->assertJsonPath('folders.0.name', '2026')
            ->assertJsonPath('folders.0.path', '/Archive/2026');
    }

    public function test_browse_folders_requires_an_active_connection(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        $token = $this->loginAsAdmin();

        $this->getJson('/api/v1/system/dropbox/folders', ['Authorization' => 'Bearer '.$token])
            ->assertStatus(409);
    }

    public function test_set_folder_updates_only_the_folder_path(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        $token = $this->loginAsAdmin();

        $this->postJson('/api/v1/system/dropbox/connect', [
            'accessToken' => 'access-token',
            'folderPath' => '/Archive',
        ], ['Authorization' => 'Bearer '.$token])->assertCreated();

        $this->patchJson('/api/v1/system/dropbox/folder', ['folderPath' => '/Archive/2026'], ['Authorization' => 'Bearer '.$token])
            ->assertOk()
            ->assertJsonPath('dropbox.folderPath', '/Archive/2026');

        $row = \DB::table('dropbox_connections')->first();
        $this->assertNotNull($row->encrypted_access_token);
    }

    public function test_set_folder_requires_an_active_connection(): void
    {
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        $token = $this->loginAsAdmin();

        $this->patchJson('/api/v1/system/dropbox/folder', ['folderPath' => '/Archive'], ['Authorization' => 'Bearer '.$token])
            ->assertStatus(409);
    }

    private function loginAsAdmin(): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => 'dropbox-admin@example.test', 'password' => 'password'])->json('accessToken');
    }
}
