<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AuthorityEntity;
use App\Models\TimedDescriptionSegment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class TimedDescriptionSegmentAuthorityEntitiesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests;
    use RefreshDatabase;

    public function test_it_links_a_timed_segment_to_a_controlled_authority_entity_with_a_role(): void
    {
        $segment = TimedDescriptionSegment::query()->create([
            'id' => (string) Str::uuid(),
            'record_id' => 'video-1',
            'start_frame' => 120,
            'end_frame' => 360,
            'title' => 'وصول الضيوف',
            'subjects' => [],
        ]);
        $entity = AuthorityEntity::query()->create([
            'id' => (string) Str::uuid(),
            'kind' => 'person',
            'preferred_label' => 'ليلى حداد',
            'aliases' => [],
        ]);

        $this->postJson('/api/v1/timed-description-segments/'.$segment->id.'/authority-entities', [
            'entityId' => $entity->id,
            'relationship' => 'on_screen',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('link.entity.preferredLabel', 'ليلى حداد')
            ->assertJsonPath('link.relationship', 'on_screen');

        $this->getJson('/api/v1/timed-description-segments/'.$segment->id.'/authority-entities', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'links')
            ->assertJsonPath('links.0.entity.id', $entity->id);

        $this->deleteJson('/api/v1/timed-description-segments/'.$segment->id.'/authority-entities/'.$entity->id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);
    }
}
