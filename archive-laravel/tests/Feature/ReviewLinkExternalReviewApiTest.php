<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V3-MEDIA-007: external (public, token-gated) review -- time-bounded links,
 * derivative-preferred media streaming, approve/request-changes decisions
 * (including dual approval), and the internal audit report. Builds on the
 * plain view/comment link covered by ReviewLinksApiTest, which must keep
 * passing unchanged.
 */
class ReviewLinkExternalReviewApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    private string $fileRoot;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fileRoot = storage_path('framework/testing/review-link-media');
        File::deleteDirectory($this->fileRoot);
        File::makeDirectory($this->fileRoot, 0755, true);
        config(['archive.file_root' => $this->fileRoot]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->fileRoot);

        parent::tearDown();
    }

    public function test_create_link_pins_version_and_starts_a_backing_review_session(): void
    {
        $this->seedRecord('record-1', 'checksum-1');

        $response = $this->postJson('/api/v1/media/record-1/review-links', [
            'permission' => 'comment',
        ], $this->authHeaders())->assertCreated();

        $this->assertDatabaseHas('review_links', [
            'token' => $response->json('token'),
            'media_uid' => 'record-1',
            'record_store' => 'archive-items',
            'version_token' => 'record:checksum-1',
        ]);

        $sessionId = DB::table('review_links')->where('token', $response->json('token'))->value('review_session_id');
        $this->assertIsString($sessionId);
        $this->assertSame('in_review', DB::table('review_sessions')->where('id', $sessionId)->value('state'));
    }

    public function test_create_link_soft_degrades_when_media_uid_is_not_a_real_record(): void
    {
        // No seeded record for "opaque-media-uid" -- the pre-V3-MEDIA-007
        // flow (ReviewLinksApiTest) must keep working unchanged.
        $response = $this->postJson('/api/v1/media/opaque-media-uid/review-links', [
            'permission' => 'comment',
        ], $this->authHeaders())->assertCreated();

        $this->assertDatabaseHas('review_links', [
            'token' => $response->json('token'),
            'media_uid' => 'opaque-media-uid',
            'record_store' => null,
            'version_token' => null,
            'review_session_id' => null,
        ]);
    }

    public function test_a_link_created_without_expiry_or_duration_still_gets_a_bounded_default(): void
    {
        $this->seedRecord('record-2', 'checksum-2');

        $response = $this->postJson('/api/v1/media/record-2/review-links', [], $this->authHeaders())->assertCreated();

        $expiresAt = DB::table('review_links')->where('token', $response->json('token'))->value('expires_at');
        $this->assertNotNull($expiresAt, 'a link must always be time-bounded');
        $this->assertTrue(now()->diffInHours($expiresAt, false) <= 168 && now()->diffInHours($expiresAt, false) > 167);
    }

    public function test_duration_hours_overrides_the_default(): void
    {
        $this->seedRecord('record-3', 'checksum-3');

        $response = $this->postJson('/api/v1/media/record-3/review-links', [
            'durationHours' => 2,
        ], $this->authHeaders())->assertCreated();

        $expiresAt = DB::table('review_links')->where('token', $response->json('token'))->value('expires_at');
        $this->assertTrue(now()->diffInMinutes($expiresAt, false) <= 120 && now()->diffInMinutes($expiresAt, false) > 118);
    }

    public function test_media_endpoint_prefers_a_ready_current_derivative_over_the_source(): void
    {
        $this->seedRecord('record-4', 'checksum-4');
        $this->writeFile('record-4/source.mov', 'source bytes');
        $this->writeFile('record-4/derivatives/thumb.jpg', 'derivative bytes');

        $derivativeId = (string) Str::uuid();
        DB::table('media_derivatives')->insert([
            'id' => $derivativeId,
            'record_store' => 'archive-items',
            'record_uid' => 'record-4',
            'attachment_id' => null,
            'derivative_type' => 'thumbnail',
            'version_token' => 'record:checksum-4',
            'settings' => json_encode([]),
            'settings_hash' => hash('sha256', json_encode([])),
            'status' => 'ready',
            'storage_key' => 'record-4/derivatives/thumb.jpg',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $token = $this->postJson('/api/v1/media/record-4/review-links', [
            'sourcePath' => 'record-4/source.mov',
            'derivativeId' => $derivativeId,
        ], $this->authHeaders())->assertCreated()->json('token');

        $media = $this->get("/api/v1/review-links/{$token}/media")->assertOk();
        $this->assertSame('derivative bytes', $media->streamedContent());
        $this->assertSame('derivative:thumbnail', $media->headers->get('X-Review-Media-Kind'));
    }

    public function test_media_endpoint_falls_back_to_source_when_the_attached_derivative_is_stale(): void
    {
        $this->seedRecord('record-4b', 'checksum-4b');
        $this->writeFile('record-4b/source.mov', 'current source bytes');
        $this->writeFile('record-4b/derivatives/stale.jpg', 'stale derivative bytes');

        $derivativeId = (string) Str::uuid();
        DB::table('media_derivatives')->insert([
            'id' => $derivativeId,
            'record_store' => 'archive-items',
            'record_uid' => 'record-4b',
            'attachment_id' => null,
            'derivative_type' => 'thumbnail',
            // Deliberately mismatched vs. the record's live checksum so
            // isCurrentVersion() is false -- the source must never fall
            // back to serving a derivative generated against a replaced
            // source.
            'version_token' => 'record:stale-checksum',
            'settings' => json_encode([]),
            'settings_hash' => hash('sha256', json_encode([])),
            'status' => 'ready',
            'storage_key' => 'record-4b/derivatives/stale.jpg',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $token = $this->postJson('/api/v1/media/record-4b/review-links', [
            'sourcePath' => 'record-4b/source.mov',
            'derivativeId' => $derivativeId,
        ], $this->authHeaders())->assertCreated()->json('token');

        $media = $this->get("/api/v1/review-links/{$token}/media")->assertOk();
        $this->assertSame('current source bytes', $media->streamedContent());
        $this->assertSame('source', $media->headers->get('X-Review-Media-Kind'));
    }

    public function test_media_endpoint_falls_back_to_source_when_no_derivative_is_attached(): void
    {
        $this->seedRecord('record-5', 'checksum-5');
        $this->writeFile('record-5/source.mov', 'plain source bytes');

        $token = $this->postJson('/api/v1/media/record-5/review-links', [
            'sourcePath' => 'record-5/source.mov',
        ], $this->authHeaders())->assertCreated()->json('token');

        $media = $this->get("/api/v1/review-links/{$token}/media")->assertOk();
        $this->assertSame('plain source bytes', $media->streamedContent());
        $this->assertSame('source', $media->headers->get('X-Review-Media-Kind'));
    }

    public function test_media_endpoint_404s_when_nothing_is_available(): void
    {
        $token = $this->postJson('/api/v1/media/record-6/review-links', [], $this->authHeaders())
            ->assertCreated()->json('token');

        $this->getJson("/api/v1/review-links/{$token}/media")->assertNotFound();
    }

    public function test_watermark_policy_is_persisted_and_reflected_on_the_media_response(): void
    {
        $this->seedRecord('record-7', 'checksum-7');
        $this->writeFile('record-7/source.mov', 'bytes');

        $token = $this->postJson('/api/v1/media/record-7/review-links', [
            'sourcePath' => 'record-7/source.mov',
            'watermarkPolicy' => 'visible',
        ], $this->authHeaders())->assertCreated()->json('token');

        $this->get("/api/v1/review-links/{$token}/media")
            ->assertOk()
            ->assertHeader('X-Review-Watermark-Policy', 'visible');
    }

    public function test_expiry_is_immediate_and_fails_closed_for_media_and_decisions(): void
    {
        $this->seedRecord('record-8', 'checksum-8');
        $this->writeFile('record-8/source.mov', 'bytes');

        $token = $this->postJson('/api/v1/media/record-8/review-links', [
            'sourcePath' => 'record-8/source.mov',
            'expiresAt' => now()->subMinute()->toISOString(),
        ], $this->authHeaders())->assertCreated()->json('token');

        $this->getJson("/api/v1/review-links/{$token}")->assertNotFound();
        $this->getJson("/api/v1/review-links/{$token}/media")->assertNotFound();
        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Late Reviewer',
            'decision' => 'approve',
        ])->assertNotFound();

        $this->assertSame(0, DB::table('review_link_decisions')->where('review_link_token', $token)->count());
    }

    public function test_single_required_approval_finalizes_the_session_immediately(): void
    {
        $this->seedRecord('record-9', 'checksum-9');
        $token = $this->postJson('/api/v1/media/record-9/review-links', [], $this->authHeaders())
            ->assertCreated()->json('token');

        $response = $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer One',
            'decision' => 'approve',
        ])->assertCreated();

        $response->assertJsonPath('session.state', 'approved')
            ->assertJsonPath('approvals.required', 1)
            ->assertJsonPath('approvals.received', 1);
    }

    public function test_dual_approval_requires_two_distinct_reviewers_and_ignores_a_repeat_vote(): void
    {
        $this->seedRecord('record-10', 'checksum-10');
        $token = $this->postJson('/api/v1/media/record-10/review-links', [
            'requiredApprovals' => 2,
        ], $this->authHeaders())->assertCreated()->json('token');

        // Same reviewer approving twice must not satisfy a dual approval.
        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer A', 'decision' => 'approve',
        ])->assertCreated()->assertJsonPath('approvals.received', 1)->assertJsonPath('session.state', 'in_review');

        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer A', 'decision' => 'approve',
        ])->assertCreated()->assertJsonPath('approvals.received', 1)->assertJsonPath('session.state', 'in_review');

        $second = $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer B', 'decision' => 'approve',
        ])->assertCreated();

        $second->assertJsonPath('approvals.received', 2)->assertJsonPath('session.state', 'approved');
    }

    public function test_request_changes_halts_approval_regardless_of_required_approvals(): void
    {
        $this->seedRecord('record-11', 'checksum-11');
        $token = $this->postJson('/api/v1/media/record-11/review-links', [], $this->authHeaders())
            ->assertCreated()->json('token');

        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer C', 'decision' => 'request_changes', 'notes' => 'fix audio levels',
        ])->assertCreated()->assertJsonPath('session.state', 'changes_requested');

        // A second reviewer's approve no longer auto-finalizes -- the
        // session is parked outside in_review until an editor resumes it.
        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer D', 'decision' => 'approve',
        ])->assertCreated()->assertJsonPath('session.state', 'changes_requested');
    }

    public function test_decisions_are_audited_without_leaking_the_token_into_the_action_field(): void
    {
        $this->seedRecord('record-12', 'checksum-12');
        $token = $this->postJson('/api/v1/media/record-12/review-links', [], $this->authHeaders())
            ->assertCreated()->json('token');

        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer E', 'decision' => 'approve',
        ])->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'review_links.decide',
            'resource_type' => 'review_link_decision',
            'outcome' => 'success',
        ]);

        $action = DB::table('audit_logs')->where('event', 'review_links.decide')->value('action');
        $this->assertIsString($action);
        $this->assertStringNotContainsString($token, $action);
    }

    public function test_decide_endpoint_is_throttled(): void
    {
        $this->seedRecord('record-13', 'checksum-13');
        $token = $this->postJson('/api/v1/media/record-13/review-links', [], $this->authHeaders())
            ->assertCreated()->json('token');

        for ($i = 0; $i < 20; $i++) {
            $this->postJson("/api/v1/review-links/{$token}/decisions", [
                'reviewerName' => "Reviewer {$i}", 'decision' => 'approve',
            ]);
        }

        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'One Too Many', 'decision' => 'approve',
        ])->assertStatus(429);
    }

    public function test_report_requires_authentication_and_proves_version_reviewers_and_decision(): void
    {
        $this->seedRecord('record-14', 'checksum-14');
        $token = $this->postJson('/api/v1/media/record-14/review-links', [
            'requiredApprovals' => 2,
        ], $this->authHeaders())->assertCreated()->json('token');

        $this->getJson("/api/v1/review-links/{$token}/report")->assertUnauthorized();
        $this->getJson("/api/v1/review-links/{$token}/report", $this->viewerHeaders())->assertForbidden();

        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer F', 'reviewerEmail' => 'f@example.test', 'decision' => 'approve', 'notes' => 'looks good',
        ])->assertCreated();

        $report = $this->getJson("/api/v1/review-links/{$token}/report", $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('report.versionToken', 'record:checksum-14')
            ->assertJsonPath('report.isCurrentVersion', true)
            ->assertJsonPath('report.session.state', 'in_review')
            ->assertJsonPath('report.approvals.required', 2)
            ->assertJsonPath('report.approvals.received', 1)
            ->assertJsonCount(1, 'report.reviewers')
            ->assertJsonPath('report.reviewers.0.reviewerName', 'Reviewer F')
            ->assertJsonPath('report.reviewers.0.decision', 'approve');

        $this->assertNotNull($report->json('report.reviewers.0.decidedAt'));
    }

    public function test_report_remains_readable_after_the_link_expires(): void
    {
        $this->seedRecord('record-15', 'checksum-15');
        $token = $this->postJson('/api/v1/media/record-15/review-links', [
            'expiresAt' => now()->addMinute()->toISOString(),
        ], $this->authHeaders())->assertCreated()->json('token');

        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Reviewer G', 'decision' => 'approve',
        ])->assertCreated();

        DB::table('review_links')->where('token', $token)->update(['expires_at' => now()->subMinute()]);

        $this->getJson("/api/v1/review-links/{$token}/report", $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('report.isExpired', true)
            ->assertJsonCount(1, 'report.reviewers');
    }

    public function test_public_show_response_never_leaks_reviewer_identities_or_storage_details(): void
    {
        $this->seedRecord('record-16', 'checksum-16');
        $this->writeFile('record-16/source.mov', 'bytes');
        $token = $this->postJson('/api/v1/media/record-16/review-links', [
            'sourcePath' => 'record-16/source.mov',
        ], $this->authHeaders())->assertCreated()->json('token');

        $this->postJson("/api/v1/review-links/{$token}/decisions", [
            'reviewerName' => 'Private Reviewer Name', 'decision' => 'approve',
        ])->assertCreated();

        $body = $this->getJson("/api/v1/review-links/{$token}")->assertOk()->getContent();
        $this->assertStringNotContainsString('Private Reviewer Name', $body);
        $this->assertStringNotContainsString('record-16/source.mov', $body);
        $this->assertStringNotContainsString($this->fileRoot, $body);
    }

    public function test_a_derivative_from_a_different_record_cannot_be_attached(): void
    {
        $this->seedRecord('record-17', 'checksum-17');
        $this->seedRecord('record-18', 'checksum-18');

        $foreignDerivativeId = (string) Str::uuid();
        DB::table('media_derivatives')->insert([
            'id' => $foreignDerivativeId,
            'record_store' => 'archive-items',
            'record_uid' => 'record-18',
            'attachment_id' => null,
            'derivative_type' => 'thumbnail',
            'version_token' => 'record:checksum-18',
            'settings' => json_encode([]),
            'settings_hash' => hash('sha256', json_encode([])),
            'status' => 'ready',
            'storage_key' => 'record-18/derivatives/thumb.jpg',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/v1/media/record-17/review-links', [
            'derivativeId' => $foreignDerivativeId,
        ], $this->authHeaders())->assertStatus(422);
    }

    private function seedRecord(string $uid, string $checksum): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode([
                'id' => $uid,
                'title' => 'External review fixture',
                'checksum' => $checksum,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function writeFile(string $relativeKey, string $contents): void
    {
        $path = $this->fileRoot.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $relativeKey);
        File::ensureDirectoryExists(dirname($path));
        File::put($path, $contents);
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Review Link Report Viewer',
            'email' => 'review-link-report-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $viewer->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }
}
