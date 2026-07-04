<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordBroadcastMetadataApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_reports_configuration_required_when_no_integration_is_configured(): void
    {
        config(['archive.broadcast.mos_endpoint' => null, 'archive.broadcast.mxf_endpoint' => null]);
        $this->seedArchiveRecord();

        $this->getJson('/api/v1/records/item-1/broadcast-metadata', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('configured', false)
            ->assertJsonPath('metadata', null);
    }

    public function test_update_is_blocked_when_not_configured(): void
    {
        config(['archive.broadcast.mos_endpoint' => null, 'archive.broadcast.mxf_endpoint' => null]);
        $this->seedArchiveRecord();

        $this->putJson('/api/v1/records/item-1/broadcast-metadata', [
            'mosObjectId' => 'MOS-1',
        ], $this->authHeaders())
            ->assertStatus(409)
            ->assertJsonPath('code', 'config_required');
    }

    public function test_it_creates_and_reads_broadcast_metadata_when_configured(): void
    {
        config(['archive.broadcast.mos_endpoint' => 'https://mos.example.test']);
        $this->seedArchiveRecord();

        $this->putJson('/api/v1/records/item-1/broadcast-metadata', [
            'mosObjectId' => 'MOS-OBJ-1',
            'mosProgramId' => 'MOS-PROG-1',
            'mxfUmid' => 'urn:smpte:umid:1',
            'mxfFormat' => 'OP1a',
        ], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('configured', true)
            ->assertJsonPath('metadata.mosObjectId', 'MOS-OBJ-1')
            ->assertJsonPath('metadata.mxfUmid', 'urn:smpte:umid:1');

        $this->getJson('/api/v1/records/item-1/broadcast-metadata', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('metadata.mosProgramId', 'MOS-PROG-1');
    }

    public function test_it_404s_for_unknown_record(): void
    {
        $this->getJson('/api/v1/records/missing-record/broadcast-metadata', $this->authHeaders())
            ->assertNotFound();
    }

    public function test_it_requires_authentication(): void
    {
        $this->getJson('/api/v1/records/item-1/broadcast-metadata')
            ->assertUnauthorized();
    }

    private function seedArchiveRecord(): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'item-1',
            'data' => json_encode([
                'uid' => 'item-1',
                'id' => 'item-1',
                'title' => 'Record with broadcast metadata',
                'type' => 'video',
                'tags' => ['broadcast'],
            ], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
