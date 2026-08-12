<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Mcp\Resources\RecordResource;
use App\Mcp\Servers\ArchiveMcpServer;
use App\Mcp\Tools\GetRecordTool;
use App\Mcp\Tools\GetSystemStatusTool;
use App\Mcp\Tools\ListArchiveTypesTool;
use App\Mcp\Tools\SearchRecordsTool;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\Fluent\AssertableJson;
use Tests\TestCase;

/**
 * MCP-803: the read tools/resource are thin delegations onto the existing
 * HTTP controllers (SearchController, RecordsController, TypesController,
 * SystemStatusController) — these tests assert the MCP wiring (auth, schema,
 * response shape), not the underlying search/read logic those controllers'
 * own tests already cover.
 */
class ArchiveMcpToolsTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_records_returns_matching_records(): void
    {
        $this->seedRecord('item-1', 'Sunset over the harbor');

        ArchiveMcpServer::actingAs($this->user())
            ->tool(SearchRecordsTool::class, ['q' => 'harbor'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json) => $json
                ->where('ok', true)
                ->has('records', 1)
                ->where('records.0.uid', 'item-1')
                ->etc());
    }

    public function test_get_record_returns_the_record(): void
    {
        $this->seedRecord('item-1', 'Sunset over the harbor');

        ArchiveMcpServer::actingAs($this->user())
            ->tool(GetRecordTool::class, ['id' => 'item-1'])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json) => $json
                ->where('ok', true)
                ->where('record.uid', 'item-1')
                ->etc());
    }

    public function test_get_record_reports_missing_records_as_a_tool_error(): void
    {
        ArchiveMcpServer::actingAs($this->user())
            ->tool(GetRecordTool::class, ['id' => 'does-not-exist'])
            ->assertStructuredContent(fn (AssertableJson $json) => $json
                ->where('ok', false)
                ->etc());
    }

    public function test_list_archive_types_returns_type_definitions(): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'video-type',
            'data' => json_encode(['id' => 'video-type', 'name' => 'Video', 'fields' => []]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        ArchiveMcpServer::actingAs($this->user())
            ->tool(ListArchiveTypesTool::class, [])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json) => $json
                ->where('ok', true)
                ->has('types', 1)
                ->where('types.0.uid', 'video-type')
                ->etc());
    }

    public function test_get_system_status_is_denied_for_a_non_admin_user(): void
    {
        ArchiveMcpServer::actingAs($this->user('viewer'))
            ->tool(GetSystemStatusTool::class, [])
            ->assertHasErrors();
    }

    public function test_get_system_status_succeeds_for_an_admin_user(): void
    {
        ArchiveMcpServer::actingAs($this->user('admin'))
            ->tool(GetSystemStatusTool::class, [])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json) => $json
                ->where('ok', true)
                ->has('metrics')
                ->has('dr')
                ->etc());
    }

    public function test_record_resource_reads_by_templated_uri(): void
    {
        $this->seedRecord('item-1', 'Sunset over the harbor');

        ArchiveMcpServer::actingAs($this->user())
            ->resource(RecordResource::class, ['id' => 'item-1'])
            ->assertOk()
            ->assertSee('"item-1"');
    }

    private function seedRecord(string $uid, string $title): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode([
                'uid' => $uid,
                'id' => $uid,
                'title' => $title,
                'type' => 'video',
                'tags' => [],
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function user(string $role = 'editor'): User
    {
        return User::factory()->create(['role' => $role]);
    }
}
