<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class NamingRulesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_upserts_lists_and_deletes_a_naming_rule(): void
    {
        $this->putJson('/api/v1/naming-rules/project-a', [
            'prefix' => 'PRJA-',
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('rule.key', 'project-a')
            ->assertJsonPath('rule.prefix', 'PRJA-');

        $this->getJson('/api/v1/naming-rules', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('rules.0.key', 'project-a');

        $this->deleteJson('/api/v1/naming-rules/project-a', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/naming-rules', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'rules');
    }

    public function test_upserting_the_same_key_replaces_the_prefix(): void
    {
        $this->putJson('/api/v1/naming-rules/project-a', ['prefix' => 'OLD-'], $this->authHeaders())->assertOk();
        $this->putJson('/api/v1/naming-rules/project-a', ['prefix' => 'NEW-'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('rule.prefix', 'NEW-');

        $this->getJson('/api/v1/naming-rules', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'rules');
    }

    public function test_it_rejects_an_empty_prefix(): void
    {
        $this->putJson('/api/v1/naming-rules/project-a', ['prefix' => ''], $this->authHeaders())
            ->assertStatus(422);
    }

    public function test_deleting_an_unknown_key_returns_not_found(): void
    {
        $this->deleteJson('/api/v1/naming-rules/unknown', [], $this->authHeaders())
            ->assertStatus(404);
    }
}
