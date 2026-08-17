<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\ReviewSession;
use App\Models\RightsRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * V3-WORK-001: the unified work inbox aggregates project_tasks, review
 * sessions, rights_records, and notifications for the caller. These tests
 * exist primarily to prove the hard acceptance bar — no cross-user
 * leakage — plus pagination and type filtering.
 */
class WorkInboxApiTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $email, string $name, string $role = 'editor'): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make('secret-password'),
            'role' => $role,
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function headersFor(User $user): array
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$response->json('accessToken')];
    }

    private function makeReviewSession(string $recordUid, ?int $createdBy, string $state = ReviewSession::STATE_IN_REVIEW): ReviewSession
    {
        return ReviewSession::query()->create([
            'id' => (string) Str::uuid(),
            'record_store' => 'archive-items',
            'record_uid' => $recordUid,
            'version_token' => 'record:'.$recordUid,
            'state' => $state,
            'created_by' => $createdBy,
        ]);
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/v1/work-inbox')->assertUnauthorized();
    }

    public function test_aggregates_all_four_sources_for_the_current_user(): void
    {
        $user = $this->makeUser('worker@example.test', 'Worker One');
        $headers = $this->headersFor($user);

        DB::table('project_tasks')->insert([
            'id' => (string) Str::uuid(),
            'project_id' => 'project-1',
            'title' => 'Caption the segment',
            'status' => 'todo',
            'assignee' => 'worker@example.test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->makeReviewSession('record-1', $user->id);

        RightsRecord::query()->create([
            'id' => (string) Str::uuid(),
            'item_id' => 'record-1',
            'rights_holder' => 'Archive Org',
            'license_type' => 'OWNED',
            'expires_at' => now()->addDays(10),
        ]);

        Notification::factory()->for($user)->create(['is_read' => false]);

        $response = $this->getJson('/api/v1/work-inbox', $headers)->assertOk();

        $types = collect($response->json('items'))->pluck('type')->all();
        sort($types);
        $this->assertSame(['notification', 'review', 'rights', 'task'], $types);
        $this->assertSame(1, $response->json('counts.task'));
        $this->assertSame(1, $response->json('counts.review'));
        $this->assertSame(1, $response->json('counts.rights'));
        $this->assertSame(1, $response->json('counts.notification'));
    }

    public function test_a_users_tasks_and_notifications_never_leak_to_another_user(): void
    {
        $owner = $this->makeUser('owner@example.test', 'Owner Person');
        // Editor role on purpose: even a caller who *can* review shared work
        // must never see someone else's personal task assignments or
        // notifications — those two sources have no shared-queue exception.
        $intruder = $this->makeUser('intruder@example.test', 'Intruder Person');

        DB::table('project_tasks')->insert([
            'id' => (string) Str::uuid(),
            'project_id' => 'project-1',
            'title' => "Owner's private task",
            'status' => 'todo',
            'assignee' => 'owner@example.test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Notification::factory()->for($owner)->create(['is_read' => false, 'title' => "Owner's notification"]);

        $response = $this->getJson('/api/v1/work-inbox', $this->headersFor($intruder))->assertOk();

        $this->assertSame(0, $response->json('counts.task'));
        $this->assertSame(0, $response->json('counts.notification'));
    }

    public function test_a_draft_review_session_is_private_to_its_creator_until_submitted(): void
    {
        // draft is deliberately excluded from the aggregation entirely (see
        // pendingReviews()) — it isn't "in review" yet, so nobody, including
        // an editor who could otherwise see the shared review queue, should
        // see it in their work inbox.
        $owner = $this->makeUser('draft-owner@example.test', 'Draft Owner');
        $other = $this->makeUser('draft-other@example.test', 'Draft Other');
        $this->makeReviewSession('draft-record', $owner->id, ReviewSession::STATE_DRAFT);

        $ownerResponse = $this->getJson('/api/v1/work-inbox', $this->headersFor($owner))->assertOk();
        $otherResponse = $this->getJson('/api/v1/work-inbox', $this->headersFor($other))->assertOk();

        $this->assertSame(0, $ownerResponse->json('counts.review'));
        $this->assertSame(0, $otherResponse->json('counts.review'));
    }

    public function test_assignee_matching_is_case_insensitive_but_scoped_to_the_caller(): void
    {
        $user = $this->makeUser('case@example.test', 'Case Person');

        DB::table('project_tasks')->insert([
            'id' => (string) Str::uuid(),
            'project_id' => 'project-1',
            'title' => 'Case-insensitive match',
            'status' => 'todo',
            'assignee' => 'CASE@EXAMPLE.TEST',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/work-inbox', $this->headersFor($user))->assertOk();

        $this->assertSame(1, $response->json('counts.task'));
    }

    public function test_done_tasks_are_excluded(): void
    {
        $user = $this->makeUser('done@example.test', 'Done Person');

        DB::table('project_tasks')->insert([
            'id' => (string) Str::uuid(),
            'project_id' => 'project-1',
            'title' => 'Already finished',
            'status' => 'done',
            'assignee' => 'done@example.test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->getJson('/api/v1/work-inbox', $this->headersFor($user))->assertOk();

        $this->assertSame(0, $response->json('counts.task'));
    }

    public function test_viewer_does_not_see_rights_expiry_but_still_sees_own_items(): void
    {
        $viewer = $this->makeUser('viewer-work@example.test', 'Viewer Person', 'viewer');

        RightsRecord::query()->create([
            'id' => (string) Str::uuid(),
            'item_id' => 'viewer-record',
            'rights_holder' => 'Archive Org',
            'license_type' => 'OWNED',
            'expires_at' => now()->addDays(5),
        ]);
        Notification::factory()->for($viewer)->create(['is_read' => false]);

        $response = $this->getJson('/api/v1/work-inbox', $this->headersFor($viewer))->assertOk();

        $this->assertSame(0, $response->json('counts.rights'));
        $this->assertSame(1, $response->json('counts.notification'));
    }

    public function test_pagination_reports_total_and_has_more(): void
    {
        $user = $this->makeUser('paged@example.test', 'Paged Person');

        Notification::factory(5)->for($user)->create(['is_read' => false]);

        $first = $this->getJson('/api/v1/work-inbox?limit=2&page=1', $this->headersFor($user))->assertOk();
        $this->assertCount(2, $first->json('items'));
        $this->assertSame(5, $first->json('pagination.total'));
        $this->assertTrue($first->json('pagination.hasMore'));

        $last = $this->getJson('/api/v1/work-inbox?limit=2&page=3', $this->headersFor($user))->assertOk();
        $this->assertCount(1, $last->json('items'));
        $this->assertFalse($last->json('pagination.hasMore'));
    }

    public function test_types_filter_restricts_the_returned_sources(): void
    {
        $user = $this->makeUser('filtered@example.test', 'Filtered Person');

        DB::table('project_tasks')->insert([
            'id' => (string) Str::uuid(),
            'project_id' => 'project-1',
            'title' => 'A task',
            'status' => 'todo',
            'assignee' => 'filtered@example.test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        Notification::factory()->for($user)->create(['is_read' => false]);

        $response = $this->getJson('/api/v1/work-inbox?'.http_build_query(['types' => ['notification']]), $this->headersFor($user))
            ->assertOk();

        $this->assertSame(0, $response->json('counts.task'));
        $this->assertSame(1, $response->json('counts.notification'));
        $items = $response->json('items');
        $this->assertCount(1, $items);
        $this->assertSame('notification', $items[0]['type']);
    }

    public function test_an_editor_sees_any_open_review_session_awaiting_review(): void
    {
        $submitter = $this->makeUser('submitter@example.test', 'Submitter Person');
        $reviewer = $this->makeUser('reviewer@example.test', 'Reviewer Person');

        $this->makeReviewSession('shared-record', $submitter->id, ReviewSession::STATE_IN_REVIEW);

        $response = $this->getJson('/api/v1/work-inbox', $this->headersFor($reviewer))->assertOk();

        $this->assertSame(1, $response->json('counts.review'));
    }

    public function test_items_link_back_to_their_source_record_href(): void
    {
        $user = $this->makeUser('linked@example.test', 'Linked Person');
        $this->makeReviewSession('linked-record', $user->id);

        $response = $this->getJson('/api/v1/work-inbox', $this->headersFor($user))->assertOk();

        $review = collect($response->json('items'))->firstWhere('type', 'review');
        $this->assertSame('/archive/linked-record?store=archive-items', $review['href']);
    }
}
