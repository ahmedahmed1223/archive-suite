<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordSegmentsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_updates_and_deletes_a_segment(): void
    {
        $created = $this->postJson('/api/v1/records/item-1/segments', [
            'title' => 'مقدمة',
            'startSeconds' => 0,
            'endSeconds' => 30,
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('segment.recordId', 'item-1')
            ->assertJsonPath('segment.title', 'مقدمة')
            ->assertJsonPath('segment.startSeconds', 0)
            ->assertJsonPath('segment.endSeconds', 30);

        $id = $created->json('segment.id');
        $this->assertIsString($id);

        $this->getJson('/api/v1/records/item-1/segments', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('segments.0.id', $id);

        $this->patchJson('/api/v1/record-segments/'.$id, ['title' => 'مقدمة معدّلة'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('segment.title', 'مقدمة معدّلة');

        $this->deleteJson('/api/v1/record-segments/'.$id, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/records/item-1/segments', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'segments');
    }

    public function test_segments_do_not_leak_across_records(): void
    {
        $this->postJson('/api/v1/records/item-1/segments', ['title' => 'أ'], $this->authHeaders())->assertCreated();
        $this->postJson('/api/v1/records/item-2/segments', ['title' => 'ب'], $this->authHeaders())->assertCreated();

        $this->getJson('/api/v1/records/item-1/segments', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'segments')
            ->assertJsonPath('segments.0.title', 'أ');
    }

    public function test_it_rejects_an_empty_title(): void
    {
        $this->postJson('/api/v1/records/item-1/segments', ['title' => ''], $this->authHeaders())
            ->assertStatus(422);
    }

    public function test_updating_an_unknown_segment_returns_not_found(): void
    {
        $this->patchJson('/api/v1/record-segments/unknown', ['title' => 'جديد'], $this->authHeaders())
            ->assertStatus(404);
    }
}
