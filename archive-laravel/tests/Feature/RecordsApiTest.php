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

    public function test_it_reads_a_single_record_by_id(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'item-001', 'id' => 'item-001', 'title' => 'Test Record', 'description' => 'A test', 'syncVersion' => 1],
            ],
        ], $this->authHeaders())
            ->assertOk();

        $this->getJson('/api/v1/records/item-001?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('record.id', 'item-001')
            ->assertJsonPath('record.uid', 'item-001')
            ->assertJsonPath('record.title', 'Test Record')
            ->assertJsonPath('record.description', 'A test')
            ->assertJsonPath('record.syncVersion', 1);
    }

    public function test_it_reads_a_single_record_by_id_without_store_param(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'item-002', 'id' => 'item-002', 'title' => 'No Store Lookup'],
            ],
        ], $this->authHeaders())
            ->assertOk();

        $this->getJson('/api/v1/records/item-002', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('record.id', 'item-002')
            ->assertJsonPath('record.title', 'No Store Lookup');
    }

    public function test_it_returns_server_authoritative_descriptor_completion_for_records(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [[
                'uid' => 'completion-001',
                'title' => '  Complete title  ',
                'description' => '  ',
                'type' => ' photograph ',
                'tags' => ['  ', 'history', '', 42],
                'descriptorCompletion' => [
                    'complete' => 4,
                    'status' => 'green',
                    'missing' => [],
                ],
            ]],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/completion-001?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.descriptorCompletion.complete', 3)
            ->assertJsonPath('record.descriptorCompletion.status', 'yellow')
            ->assertJsonPath('record.descriptorCompletion.missing', ['description']);
    }

    public function test_it_classifies_descriptor_completion_as_green_yellow_or_red(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                [
                    'uid' => 'completion-green',
                    'title' => 'عنوان',
                    'description' => 'وصف',
                    'type' => 'document',
                    'tags' => ['archive'],
                ],
                [
                    'uid' => 'completion-red',
                    'title' => 'عنوان فقط',
                    'description' => '',
                    'type' => ' ',
                    'tags' => [' '],
                ],
            ],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/completion-green?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.descriptorCompletion.status', 'green')
            ->assertJsonPath('record.descriptorCompletion.complete', 4)
            ->assertJsonPath('record.descriptorCompletion.missing', []);

        $this->getJson('/api/v1/records/completion-red?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.descriptorCompletion.status', 'red')
            ->assertJsonPath('record.descriptorCompletion.complete', 1)
            ->assertJsonPath('record.descriptorCompletion.missing', ['description', 'type', 'tags']);
    }

    public function test_it_returns_404_for_nonexistent_record(): void
    {
        $this->getJson('/api/v1/records/nonexistent-id?store=archive-items', $this->authHeaders())
            ->assertNotFound()
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'not_found');
    }

    public function test_it_rejects_unauthenticated_record_detail_requests(): void
    {
        $this->getJson('/api/v1/records/item-001?store=archive-items')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    public function test_it_bulk_deletes_records_and_reports_per_item_results(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'del-001', 'title' => 'First'],
                ['uid' => 'del-002', 'title' => 'Second'],
                ['uid' => 'del-003', 'title' => 'Third'],
            ],
        ], $this->authHeaders())->assertOk();

        $this->postJson('/api/v1/records/bulk-delete', [
            'store' => 'archive-items',
            'ids' => ['del-001', 'del-003', 'missing-id'],
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('count', 2)
            ->assertJsonPath('results.0.uid', 'del-001')
            ->assertJsonPath('results.0.deleted', true)
            ->assertJsonPath('results.1.deleted', true)
            ->assertJsonPath('results.2.uid', 'missing-id')
            ->assertJsonPath('results.2.deleted', false);

        $this->getJson('/api/v1/records?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'records')
            ->assertJsonPath('records.0.uid', 'del-002');
    }

    public function test_bulk_delete_requires_at_least_one_id(): void
    {
        $this->postJson('/api/v1/records/bulk-delete', [
            'store' => 'archive-items',
            'ids' => [],
        ], $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ids');
    }

    public function test_it_rejects_unauthenticated_bulk_delete_requests(): void
    {
        $this->postJson('/api/v1/records/bulk-delete', [
            'store' => 'archive-items',
            'ids' => ['del-001'],
        ])
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

}
