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
}
