<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class UploadLinksApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_and_revokes_upload_links(): void
    {
        $created = $this->postJson('/api/v1/upload-links', [
            'label' => 'Field crew drop',
            'folder' => 'incoming/field',
            'expiresInHours' => 48,
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('link.label', 'Field crew drop')
            ->assertJsonPath('link.folder', 'incoming/field')
            ->assertJsonPath('link.revoked', false);

        $token = $created->json('link.token');
        $this->assertIsString($token);
        $this->assertNotEmpty($token);

        $this->getJson('/api/v1/upload-links', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'links')
            ->assertJsonPath('links.0.token', $token);

        // Public validation endpoint works while active.
        $this->getJson('/api/v1/upload-links/'.$token)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('link.folder', 'incoming/field');

        $id = $created->json('link.id');
        $this->postJson('/api/v1/upload-links/'.$id.'/revoke', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('link.revoked', true);

        $this->getJson('/api/v1/upload-links/'.$token)
            ->assertNotFound()
            ->assertJsonPath('code', 'revoked');
    }

    public function test_it_rejects_expired_link_validation(): void
    {
        $created = $this->postJson('/api/v1/upload-links', [
            'label' => 'Short lived',
            'expiresInHours' => 1,
        ], $this->authHeaders())->assertCreated();

        $token = $created->json('link.token');

        \Illuminate\Support\Facades\DB::table('upload_links')
            ->where('token', $token)
            ->update(['expires_at' => now()->subHour()]);

        $this->getJson('/api/v1/upload-links/'.$token)
            ->assertNotFound()
            ->assertJsonPath('code', 'expired');
    }

    public function test_it_rejects_invalid_upload_link_payload(): void
    {
        $this->postJson('/api/v1/upload-links', [
            'expiresInHours' => 0,
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/upload-links')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }
}
