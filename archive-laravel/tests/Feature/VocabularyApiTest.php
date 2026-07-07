<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class VocabularyApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_and_deletes_vocabulary_terms(): void
    {
        $created = $this->postJson('/api/v1/vocabulary', [
            'term' => 'مقابلة',
            'kind' => 'type',
            'aliases' => 'interview',
            'note' => 'محتوى حواري',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('term.term', 'مقابلة')
            ->assertJsonPath('term.kind', 'type')
            ->assertJsonPath('term.aliases', 'interview');

        $id = $created->json('term.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/vocabulary', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'terms')
            ->assertJsonPath('terms.0.id', $id);

        $this->deleteJson('/api/v1/vocabulary/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/vocabulary', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'terms');
    }

    public function test_it_defaults_kind_to_custom(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'بلا نوع',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('term.kind', 'custom');
    }

    public function test_it_scopes_terms_to_the_owning_user(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'Mine',
        ], $this->authHeaders())->assertCreated();

        \App\Models\User::query()->firstOrCreate(
            ['email' => 'other@example.test'],
            ['name' => 'Other User', 'password' => \Illuminate\Support\Facades\Hash::make('secret-password')]
        );
        $otherToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'other@example.test',
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');

        $this->getJson('/api/v1/vocabulary', ['Authorization' => 'Bearer '.$otherToken])
            ->assertOk()
            ->assertJsonCount(0, 'terms');
    }

    public function test_it_rejects_invalid_vocabulary_payload(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => '',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_invalid_kind(): void
    {
        $this->postJson('/api/v1/vocabulary', [
            'term' => 'Bad kind',
            'kind' => 'nope',
        ], $this->authHeaders())->assertUnprocessable();
    }

    public function test_it_rejects_deleting_missing_term(): void
    {
        $this->deleteJson('/api/v1/vocabulary/missing', [], $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/v1/vocabulary')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }
}
