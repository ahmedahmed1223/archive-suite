<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Mcp\Servers\ArchiveMcpServer;
use App\Mcp\Tools\CreateReviewRequestTool;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\Fluent\AssertableJson;
use Tests\TestCase;

/**
 * MCP-804: create_review_request must only ever file a draft
 * (record_field_requests) — it can never write the record — and every call
 * must land an audit_log row, success or failure, with sensitive args
 * redacted.
 */
class ArchiveMcpReviewRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_files_a_draft_review_request_without_touching_the_record(): void
    {
        $this->seedRecord('item-1', ['title' => 'Original title']);

        ArchiveMcpServer::actingAs(User::factory()->create(['role' => 'editor']))
            ->tool(CreateReviewRequestTool::class, [
                'recordId' => 'item-1',
                'field' => 'title',
                'message' => 'Title has a typo, should be "Sunset Harbor".',
            ])
            ->assertOk()
            ->assertStructuredContent(fn (AssertableJson $json) => $json
                ->where('ok', true)
                ->where('request.recordId', 'item-1')
                ->where('request.field', 'title')
                ->etc());

        $this->assertDatabaseHas('record_field_requests', [
            'record_id' => 'item-1',
            'field' => 'title',
        ]);

        // The record itself must be unchanged — this tool only ever drafts a
        // request, it never applies the edit.
        $row = DB::table('storage_rows')->where('store', 'archive-items')->where('uid', 'item-1')->first();
        $this->assertSame('Original title', json_decode((string) $row->data, true)['title']);
    }

    public function test_it_writes_an_audit_log_entry_with_redacted_metadata(): void
    {
        $this->seedRecord('item-1', ['title' => 'Original title']);
        $user = User::factory()->create(['role' => 'editor']);

        ArchiveMcpServer::actingAs($user)
            ->tool(CreateReviewRequestTool::class, [
                'recordId' => 'item-1',
                'field' => 'title',
                'message' => 'contains a secret_token=abc123 by mistake',
            ])
            ->assertOk();

        $log = AuditLog::query()->where('event', 'mcp_review_request.create')->latest('id')->first();

        $this->assertNotNull($log);
        $this->assertSame('success', $log->outcome);
        $this->assertSame($user->id, $log->actor_id);
        $this->assertSame('create_review_request', $log->metadata['tool']);
        $this->assertIsInt($log->metadata['durationMs']);
        $this->assertArrayHasKey('args', $log->metadata);
    }

    public function test_invalid_arguments_are_reported_as_a_tool_error(): void
    {
        ArchiveMcpServer::actingAs(User::factory()->create(['role' => 'editor']))
            ->tool(CreateReviewRequestTool::class, [
                'recordId' => 'does-not-matter',
                'field' => 'title',
                'message' => '',
            ])
            ->assertHasErrors();
    }

    /** @param array<string, mixed> $data */
    private function seedRecord(string $uid, array $data): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode(['uid' => $uid, 'id' => $uid, ...$data], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
