<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class SensitiveOperationPoliciesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_index_lists_the_seeded_operation_catalog_and_defaults_to_not_sensitive(): void
    {
        $response = $this->getJson('/api/v1/sensitive-operation-policies', $this->authHeaders())
            ->assertOk();

        $keys = array_column($response->json('policies'), 'operationKey');
        sort($keys);
        $this->assertSame(['add-tag', 'delete', 'set-rights-holder', 'set-workflow-status'], $keys);
        $this->assertFalse($response->json('policies.0.sensitive'));
    }

    public function test_an_editor_cannot_update_a_policy(): void
    {
        $this->patchJson('/api/v1/sensitive-operation-policies/delete', ['sensitive' => true], $this->authHeaders())
            ->assertForbidden();
    }

    public function test_an_admin_can_toggle_sensitivity_and_required_approvals(): void
    {
        $admin = $this->adminHeaders();

        $this->patchJson('/api/v1/sensitive-operation-policies/delete', [
            'sensitive' => true, 'requiredApprovals' => 3,
        ], $admin)
            ->assertOk()
            ->assertJsonPath('policy.sensitive', true)
            ->assertJsonPath('policy.requiredApprovals', 3);

        $listed = $this->getJson('/api/v1/sensitive-operation-policies', $this->authHeaders())->assertOk();
        $deletePolicy = collect($listed->json('policies'))->firstWhere('operationKey', 'delete');
        $this->assertTrue($deletePolicy['sensitive']);
        $this->assertSame(3, $deletePolicy['requiredApprovals']);
    }

    public function test_unknown_operation_key_returns_not_found(): void
    {
        $this->patchJson('/api/v1/sensitive-operation-policies/does-not-exist', ['sensitive' => true], $this->adminHeaders())
            ->assertNotFound();
    }

    public function test_empty_update_is_rejected(): void
    {
        $this->patchJson('/api/v1/sensitive-operation-policies/delete', [], $this->adminHeaders())
            ->assertUnprocessable();
    }

    /** @return array<string, string> */
    private function adminHeaders(): array
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'sensitive-policy-admin@example.test'],
            ['name' => 'Admin', 'password' => Hash::make('secret-password'), 'role' => 'admin'],
        );
        $token = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'secret-password'])
            ->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
