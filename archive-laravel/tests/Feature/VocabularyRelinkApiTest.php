<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class VocabularyRelinkApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_preview_lists_records_tagged_with_the_term(): void
    {
        $termId = $this->createTerm('سياسة-قديمة');
        $this->seedRecord('item-1', ['سياسة-قديمة', 'أرشيف']);
        $this->seedRecord('item-2', ['غير-ذلك']);

        $this->getJson("/api/v1/vocabulary/{$termId}/relink-preview", $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('term', 'سياسة-قديمة')
            ->assertJsonPath('affectedCount', 1)
            ->assertJsonPath('records.0.id', 'item-1');
    }

    public function test_relink_replaces_the_term_on_every_affected_record_and_deletes_it(): void
    {
        $termId = $this->createTerm('سياسة-قديمة');
        $this->seedRecord('item-1', ['سياسة-قديمة', 'أرشيف']);

        $this->postJson("/api/v1/vocabulary/{$termId}/relink", ['replacement' => 'سياسة'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('relinked.0', 'item-1')
            ->assertJsonPath('replacement', 'سياسة');

        $record = $this->getJson('/api/v1/records/item-1?store=archive-items', $this->authHeaders())->assertOk();
        $this->assertContains('سياسة', $record->json('record.tags'));
        $this->assertNotContains('سياسة-قديمة', $record->json('record.tags'));

        $this->assertSame(0, DB::table('vocabulary_terms')->where('id', $termId)->count());
    }

    public function test_relink_with_no_replacement_removes_the_tag(): void
    {
        $termId = $this->createTerm('مؤقت');
        $this->seedRecord('item-1', ['مؤقت', 'أرشيف']);

        $this->postJson("/api/v1/vocabulary/{$termId}/relink", [], $this->authHeaders())->assertOk();

        $record = $this->getJson('/api/v1/records/item-1?store=archive-items', $this->authHeaders())->assertOk();
        $this->assertSame(['أرشيف'], $record->json('record.tags'));
    }

    private function createTerm(string $term): string
    {
        return $this->postJson('/api/v1/vocabulary', ['term' => $term], $this->authHeaders())
            ->assertCreated()->json('term.id');
    }

    private function seedRecord(string $id, array $tags): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => $id, 'id' => $id, 'title' => 'Record '.$id, 'tags' => $tags,
        ]]], $this->authHeaders())->assertOk();
    }
}
