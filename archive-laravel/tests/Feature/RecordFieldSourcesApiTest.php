<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordFieldSourcesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_it_records_and_lists_field_sources_when_sent(): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => 'item-1', 'title' => 'من قالب', 'description' => 'يدوي',
            'fieldSources' => ['title' => 'template', 'description' => 'manual'],
        ]]], $this->authHeaders())->assertOk();

        $response = $this->getJson('/api/v1/records/item-1/field-sources', $this->authHeaders())->assertOk();
        $sources = collect($response->json('sources'))->keyBy('field');
        $this->assertSame('template', $sources['title']['source']);
        $this->assertSame('manual', $sources['description']['source']);
    }

    public function test_field_sources_never_leak_into_the_stored_record(): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => 'item-1', 'title' => 'عنوان',
            'fieldSources' => ['title' => 'csv'],
        ]]], $this->authHeaders())->assertOk();

        $record = $this->getJson('/api/v1/records/item-1?store=archive-items', $this->authHeaders())->assertOk();
        $this->assertArrayNotHasKey('fieldSources', $record->json('record'));
    }

    public function test_omitting_field_sources_leaves_no_rows(): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => 'item-1', 'title' => 'عنوان',
        ]]], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/item-1/field-sources', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'sources');
    }

    public function test_it_rejects_an_invalid_source_value(): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => 'item-1', 'title' => 'عنوان',
            'fieldSources' => ['title' => 'not-a-real-source'],
        ]]], $this->authHeaders())->assertStatus(422);
    }
}
