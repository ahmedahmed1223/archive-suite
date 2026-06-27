<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ArchiveSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_archive_contract_tables_are_migrated(): void
    {
        $this->assertTrue(Schema::hasTable('storage_rows'));
        $this->assertTrue(Schema::hasTable('rights_records'));
        $this->assertTrue(Schema::hasTable('share_links'));
        $this->assertTrue(Schema::hasTable('audit_logs'));
        $this->assertTrue(Schema::hasTable('api_sessions'));

        foreach (['store', 'uid', 'data', 'sync_version', 'last_modified_by'] as $column) {
            $this->assertTrue(Schema::hasColumn('storage_rows', $column), "storage_rows should include {$column}");
        }

        foreach ([
            'id',
            'item_id',
            'rights_holder',
            'license_type',
            'embargo_start',
            'embargo_end',
            'expires_at',
            'geo_restrictions',
            'notes',
        ] as $column) {
            $this->assertTrue(Schema::hasColumn('rights_records', $column), "rights_records should include {$column}");
        }
    }
}
