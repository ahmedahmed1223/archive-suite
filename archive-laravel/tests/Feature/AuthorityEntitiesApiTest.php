<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class AuthorityEntitiesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests;
    use RefreshDatabase;

    public function test_it_creates_and_lists_an_authority_entity_separately_from_record_tags(): void
    {
        $created = $this->postJson('/api/v1/authority-entities', [
            'kind' => 'person',
            'preferredLabel' => 'ليلى حداد',
            'aliases' => ['ليلى الحداد', 'Laila Haddad'],
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('entity.kind', 'person')
            ->assertJsonPath('entity.preferredLabel', 'ليلى حداد')
            ->assertJsonPath('entity.aliases.1', 'Laila Haddad');

        $this->getJson('/api/v1/authority-entities?kind=person', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'entities')
            ->assertJsonPath('entities.0.id', $created->json('entity.id'));
    }
}
