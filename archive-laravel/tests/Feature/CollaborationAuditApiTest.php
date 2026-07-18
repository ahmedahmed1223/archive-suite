<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CollaborationAuditApiTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $email, string $name): string
    {
        User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make('password'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password',
        ])->assertOk();

        return (string) $response->json('accessToken');
    }

    /** @return array<string, string> */
    private function auth(string $token): array
    {
        return ['Authorization' => 'Bearer '.$token];
    }

    public function test_lock_acquire_refresh_and_release_have_distinct_audit_events(): void
    {
        $token = $this->login('editor@example.test', 'Archive Editor');
        $url = '/api/v1/collaboration/rooms/review-1/locks';

        $this->postJson($url, ['resourceId' => 'record-1', 'ttlSeconds' => 120], $this->auth($token))->assertCreated();
        $this->postJson($url, ['resourceId' => 'record-1', 'ttlSeconds' => 180], $this->auth($token))->assertOk();
        $this->postJson($url.'/release', ['resourceId' => 'record-1'], $this->auth($token))->assertOk();

        $logs = AuditLog::query()->orderBy('id')->get();
        $this->assertSame([
            'collaboration_locks.acquire',
            'collaboration_locks.refresh',
            'collaboration_locks.release',
        ], $logs->pluck('event')->all());
        $this->assertSame(['record-1', 'record-1', 'record-1'], $logs->pluck('resource_id')->all());
        $this->assertSame('collaboration_lock', $logs[0]->resource_type);
        $this->assertSame('review-1', data_get($logs[0]->metadata, 'collaboration.roomKey'));
        $this->assertSame(120, data_get($logs[0]->metadata, 'collaboration.ttlSeconds'));
        $this->assertTrue(data_get($logs[2]->metadata, 'collaboration.released'));
    }

    public function test_document_update_audit_summarizes_versions_without_storing_content(): void
    {
        $token = $this->login('editor@example.test', 'Archive Editor');
        $secret = 'TOP SECRET COLLABORATION CONTENT';

        $this->postJson('/api/v1/collaboration/rooms/review-1/documents/record-1', [
            'content' => $secret,
            'version' => 0,
        ], $this->auth($token))->assertOk();

        $log = AuditLog::query()->sole();
        $this->assertSame('collaboration_documents.update', $log->event);
        $this->assertSame('collaboration_document', $log->resource_type);
        $this->assertSame('record-1', $log->resource_id);
        $this->assertSame(0, data_get($log->metadata, 'collaboration.requestedVersion'));
        $this->assertSame(1, data_get($log->metadata, 'collaboration.resultVersion'));
        $this->assertSame(strlen($secret), data_get($log->metadata, 'collaboration.contentBytes'));
        $this->assertArrayNotHasKey('request', $log->metadata);
        $this->assertStringNotContainsString($secret, json_encode($log->metadata, JSON_THROW_ON_ERROR));
    }

    public function test_rejected_lock_conflict_is_audited_for_the_rejected_actor(): void
    {
        $firstToken = $this->login('first@example.test', 'First Editor');
        $secondToken = $this->login('second@example.test', 'Second Editor');
        $url = '/api/v1/collaboration/rooms/review-1/locks';

        $this->postJson($url, ['resourceId' => 'record-1'], $this->auth($firstToken))->assertCreated();
        $this->postJson($url, ['resourceId' => 'record-1'], $this->auth($secondToken))->assertConflict();

        $log = AuditLog::query()->where('outcome', 'rejected')->sole();
        $this->assertSame('collaboration_locks.acquire', $log->event);
        $this->assertSame(409, $log->status_code);
        $this->assertSame('second@example.test', User::query()->findOrFail($log->actor_id)->email);
    }

    public function test_presence_heartbeat_is_not_audited(): void
    {
        $token = $this->login('editor@example.test', 'Archive Editor');

        $this->postJson('/api/v1/collaboration/rooms/review-1/presence', [
            'status' => 'editing',
            'resourceId' => 'record-1',
        ], $this->auth($token))->assertOk();

        $this->assertDatabaseCount('audit_logs', 0);
    }
}
