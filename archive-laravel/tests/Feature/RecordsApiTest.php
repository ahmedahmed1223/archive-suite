<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Support\AuthenticatesArchiveRequests;

class RecordsApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_bulk_upserts_and_lists_records_with_cursor_pagination(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'a-001', 'title' => 'First', 'syncVersion' => 1],
                ['uid' => 'a-002', 'title' => 'Second', 'syncVersion' => 2],
                ['uid' => 'a-003', 'title' => 'Third', 'syncVersion' => 3],
            ],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('count', 3);

        $firstPage = $this->getJson('/api/v1/records?store=archive-items&limit=2', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'records')
            ->assertJsonPath('records.0.uid', 'a-001')
            ->assertJsonPath('records.1.title', 'Second');

        $cursor = $firstPage->json('nextCursor');
        $this->assertIsString($cursor);

        $this->getJson('/api/v1/records?store=archive-items&limit=2&cursor='.$cursor, $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'a-003')
            ->assertJsonPath('nextCursor', null);
    }

    public function test_it_requires_uid_or_id_for_bulk_records(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['title' => 'No identifier']],
        ], $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('records.0.uid');
    }

    public function test_it_rejects_unauthenticated_record_requests(): void
    {
        $this->getJson('/api/v1/records?store=archive-items')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

}
