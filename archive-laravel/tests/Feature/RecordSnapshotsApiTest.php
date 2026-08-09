<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordSnapshotsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_creating_a_record_takes_no_snapshot_only_updating_does(): void
    {
        $this->seedRecord('item-1', 'العنوان الأول');
        $this->assertSame(0, DB::table('record_metadata_snapshots')->where('record_id', 'item-1')->count());

        $this->seedRecord('item-1', 'العنوان الثاني');
        $this->assertSame(1, DB::table('record_metadata_snapshots')->where('record_id', 'item-1')->count());
    }

    public function test_diff_reports_which_fields_changed_since_the_snapshot(): void
    {
        $this->seedRecord('item-1', 'العنوان الأول');
        $this->seedRecord('item-1', 'العنوان الثاني');

        $snapshotId = DB::table('record_metadata_snapshots')->where('record_id', 'item-1')->value('id');

        $diff = $this->getJson("/api/v1/records/item-1/snapshots/{$snapshotId}/diff", $this->authHeaders())
            ->assertOk()
            ->json('fields');

        $titleField = collect($diff)->firstWhere('field', 'title');
        $this->assertSame('العنوان الأول', $titleField['previous']);
        $this->assertSame('العنوان الثاني', $titleField['current']);
        $this->assertTrue($titleField['changed']);
    }

    public function test_restore_reverts_the_chosen_field_and_snapshots_the_pre_restore_state(): void
    {
        $this->seedRecord('item-1', 'العنوان الأول');
        $this->seedRecord('item-1', 'العنوان الثاني');
        $snapshotId = DB::table('record_metadata_snapshots')->where('record_id', 'item-1')->value('id');

        $this->postJson("/api/v1/records/item-1/snapshots/{$snapshotId}/restore", ['fields' => ['title']], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('restoredFields.0', 'title');

        $this->getJson('/api/v1/records/item-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.title', 'العنوان الأول');

        $this->assertSame(2, DB::table('record_metadata_snapshots')->where('record_id', 'item-1')->count());
    }

    public function test_diff_on_an_unknown_snapshot_returns_not_found(): void
    {
        $this->seedRecord('item-1', 'العنوان');
        $this->getJson('/api/v1/records/item-1/snapshots/unknown/diff', $this->authHeaders())->assertStatus(404);
    }

    public function test_listing_snapshots_returns_newest_first(): void
    {
        $this->seedRecord('item-1', 'نسخة 1');
        $this->seedRecord('item-1', 'نسخة 2');
        $this->seedRecord('item-1', 'نسخة 3');

        $this->getJson('/api/v1/records/item-1/snapshots', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'snapshots');
    }

    private function seedRecord(string $id, string $title): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => $id, 'id' => $id, 'title' => $title, 'description' => '', 'type' => 'video', 'tags' => [],
        ]]], $this->authHeaders())->assertOk();
    }
}
