<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AuthorityEntity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordAuthorityEntitiesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests;
    use RefreshDatabase;

    public function test_it_links_a_record_to_a_controlled_authority_entity_with_a_role(): void
    {
        $entity = AuthorityEntity::query()->create(['id' => (string) Str::uuid(), 'kind' => 'person', 'preferred_label' => 'ليلى حداد', 'aliases' => []]);

        $this->postJson('/api/v1/records/video-1/authority-entities', ['entityId' => $entity->id, 'relationship' => 'presenter'], $this->authHeaders())
            ->assertCreated()->assertJsonPath('link.entity.preferredLabel', 'ليلى حداد')->assertJsonPath('link.relationship', 'presenter');

        $this->getJson('/api/v1/records/video-1/authority-entities', $this->authHeaders())
            ->assertOk()->assertJsonCount(1, 'links')->assertJsonPath('links.0.entity.id', $entity->id);

        $this->deleteJson('/api/v1/records/video-1/authority-entities/'.$entity->id, [], $this->authHeaders())
            ->assertOk()->assertJsonPath('deleted', true);
    }
}
