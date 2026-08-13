<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Ai\Tools\GetArchiveRecordTool;
use App\Ai\Tools\SearchArchiveRecordsTool;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Ai\Tools\Request;
use Tests\TestCase;

/**
 * AI-802: the two tools are exercised directly (no LLM involved at all)
 * to prove they return exactly what the read-only HTTP endpoints already
 * return - they delegate to SearchController/RecordsController, not a
 * reimplementation.
 */
class ArchiveAssistantToolsTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_tool_finds_a_seeded_record(): void
    {
        $this->seedRecord('item-1', ['title' => 'Sunset Harbor Interview']);
        $user = User::factory()->create(['role' => 'editor']);

        $result = json_decode(
            (new SearchArchiveRecordsTool($user))->handle(new Request(['query' => 'Sunset Harbor'])),
            true
        );

        $this->assertTrue($result['ok']);
        $this->assertSame('item-1', $result['records'][0]['uid'] ?? $result['records'][0]['id'] ?? null);
    }

    public function test_get_record_tool_reads_a_single_record(): void
    {
        $this->seedRecord('item-2', ['title' => 'Original title']);
        $user = User::factory()->create(['role' => 'editor']);

        $result = json_decode(
            (new GetArchiveRecordTool($user))->handle(new Request(['id' => 'item-2'])),
            true
        );

        $this->assertTrue($result['ok']);
        $this->assertSame('Original title', $result['record']['title']);
    }

    public function test_get_record_tool_reports_not_found(): void
    {
        $user = User::factory()->create(['role' => 'editor']);

        $result = json_decode(
            (new GetArchiveRecordTool($user))->handle(new Request(['id' => 'does-not-exist'])),
            true
        );

        $this->assertFalse($result['ok']);
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
