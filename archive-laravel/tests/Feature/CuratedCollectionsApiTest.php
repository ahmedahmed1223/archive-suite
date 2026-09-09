<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class CuratedCollectionsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests;
    use RefreshDatabase;

    public function test_it_creates_an_editorial_collection_separate_from_personal_smart_collections(): void
    {
        $created = $this->postJson('/api/v1/curated-collections', [
            'title' => 'شهادات من الأرشيف',
            'introduction' => 'اختيار تحريري لمواد موثقة.',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('collection.title', 'شهادات من الأرشيف')
            ->assertJsonPath('collection.status', 'draft');

        $this->getJson('/api/v1/curated-collections', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'collections')
            ->assertJsonPath('collections.0.id', $created->json('collection.id'));
    }

    public function test_an_editor_can_set_the_explicit_order_of_records_in_a_curated_collection(): void
    {
        $collectionId = $this->postJson('/api/v1/curated-collections', ['title' => 'نشرة المساء'], $this->authHeaders())
            ->assertCreated()
            ->json('collection.id');

        $this->postJson("/api/v1/curated-collections/{$collectionId}/records/record-a", [], $this->authHeaders())->assertOk();
        $this->postJson("/api/v1/curated-collections/{$collectionId}/records/record-b", [], $this->authHeaders())->assertOk();

        $this->putJson("/api/v1/curated-collections/{$collectionId}/records/order", ['recordIds' => ['record-b', 'record-a']], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('recordIds.0', 'record-b')
            ->assertJsonPath('recordIds.1', 'record-a');

        $this->getJson("/api/v1/curated-collections/{$collectionId}/records", $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('recordIds.0', 'record-b')
            ->assertJsonPath('recordIds.1', 'record-a');
    }
}
