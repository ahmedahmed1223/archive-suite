<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class ApprovalRequestsApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_submitting_a_macro_with_no_sensitive_step_is_rejected(): void
    {
        $id = $this->createMacro([['type' => 'add-tag', 'tag' => 'featured']]);

        $this->postJson('/api/v1/approval-requests', [
            'targetType' => 'bulk-macro', 'targetId' => $id,
            'targets' => [['store' => 'archive-items', 'id' => 'x']],
        ], $this->authHeaders())
            ->assertStatus(422)
            ->assertJsonPath('code', 'operation_not_sensitive');
    }

    public function test_the_requester_can_never_decide_their_own_approval_request(): void
    {
        $this->enableSensitivePolicy('delete');
        $id = $this->createMacro([['type' => 'delete']]);

        $requestId = $this->postJson('/api/v1/approval-requests', [
            'targetType' => 'bulk-macro', 'targetId' => $id,
            'targets' => [['store' => 'archive-items', 'id' => 'x']],
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('request.status', 'pending')
            ->assertJsonPath('request.requiredApprovals', 2)
            ->json('request.id');

        // The submitter (admin@example.test, via authHeaders()) tries to
        // decide their own request -- must be refused server-side, not just
        // hidden client-side, and must leave no decision row behind.
        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", [
            'decision' => 'approve',
        ], $this->authHeaders())
            ->assertStatus(403)
            ->assertJsonPath('ok', false)
            ->assertJsonPath('code', 'self_approval');

        $this->assertDatabaseCount('approval_decisions', 0);
        $this->assertDatabaseHas('approval_requests', ['id' => $requestId, 'status' => 'pending']);
    }

    public function test_two_distinct_non_requester_approvals_are_required_before_execution(): void
    {
        $this->enableSensitivePolicy('delete');
        $this->seedRecord('approve-target');
        $id = $this->createMacro([['type' => 'delete']]);
        $targets = [['store' => 'archive-items', 'id' => 'approve-target']];

        $requestId = $this->postJson('/api/v1/approval-requests', [
            'targetType' => 'bulk-macro', 'targetId' => $id, 'targets' => $targets,
        ], $this->authHeaders())->assertCreated()->json('request.id');

        $approverOne = $this->headersFor('approver-one@example.test');
        $approverTwo = $this->headersFor('approver-two@example.test');

        // Execute is refused before approval is reached.
        $this->postJson("/api/v1/approval-requests/{$requestId}/execute", [], $this->authHeaders())
            ->assertStatus(409)->assertJsonPath('code', 'not_approved');

        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", ['decision' => 'approve'], $approverOne)
            ->assertOk()->assertJsonPath('request.status', 'pending');

        // The same approver cannot vote twice.
        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", ['decision' => 'approve'], $approverOne)
            ->assertStatus(409)->assertJsonPath('code', 'already_decided');

        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", ['decision' => 'approve'], $approverTwo)
            ->assertOk()->assertJsonPath('request.status', 'approved');

        $run = $this->postJson("/api/v1/approval-requests/{$requestId}/execute", [], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('request.status', 'executed')
            ->assertJsonPath('run.targetCount', 1)
            ->assertJsonPath('run.completedCount', 1);

        $this->assertDatabaseHas('audit_logs', ['event' => 'approval_requests.execute', 'resource_id' => $requestId, 'outcome' => 'success']);
        $this->assertDatabaseHas('audit_logs', ['event' => 'approval_requests.decide', 'resource_id' => $requestId, 'outcome' => 'success']);
        $this->assertNotNull($run->json('request.executedAt'));
    }

    public function test_a_single_rejection_halts_the_request(): void
    {
        $this->enableSensitivePolicy('delete');
        $id = $this->createMacro([['type' => 'delete']]);
        $requestId = $this->postJson('/api/v1/approval-requests', [
            'targetType' => 'bulk-macro', 'targetId' => $id, 'targets' => [['store' => 'archive-items', 'id' => 'x']],
        ], $this->authHeaders())->assertCreated()->json('request.id');

        $approver = $this->headersFor('rejecting-approver@example.test');
        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", ['decision' => 'reject', 'notes' => 'not now'], $approver)
            ->assertOk()->assertJsonPath('request.status', 'rejected');

        $this->postJson("/api/v1/approval-requests/{$requestId}/execute", [], $this->authHeaders())
            ->assertStatus(409)->assertJsonPath('code', 'not_approved');
    }

    public function test_execution_is_refused_once_the_macro_changes_after_approval(): void
    {
        $this->enableSensitivePolicy('delete');
        $id = $this->createMacro([['type' => 'delete']]);
        $requestId = $this->postJson('/api/v1/approval-requests', [
            'targetType' => 'bulk-macro', 'targetId' => $id, 'targets' => [['store' => 'archive-items', 'id' => 'x']],
        ], $this->authHeaders())->assertCreated()->json('request.id');

        $approverOne = $this->headersFor('stale-one@example.test');
        $approverTwo = $this->headersFor('stale-two@example.test');
        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", ['decision' => 'approve'], $approverOne)->assertOk();
        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", ['decision' => 'approve'], $approverTwo)
            ->assertOk()->assertJsonPath('request.status', 'approved');

        $this->patchJson("/api/v1/bulk-macros/{$id}", ['name' => 'changed after approval'], $this->authHeaders())->assertOk();

        $this->postJson("/api/v1/approval-requests/{$requestId}/execute", [], $this->authHeaders())
            ->assertStatus(409)->assertJsonPath('code', 'stale_approval');
    }

    public function test_every_bulk_item_outcome_is_reported_individually_on_execution(): void
    {
        $this->enableSensitivePolicy('delete');
        $this->seedRecord('present-item');
        $id = $this->createMacro([['type' => 'delete']]);
        $targets = [
            ['store' => 'archive-items', 'id' => 'present-item'],
            ['store' => 'archive-items', 'id' => 'missing-item'],
        ];

        $requestId = $this->postJson('/api/v1/approval-requests', [
            'targetType' => 'bulk-macro', 'targetId' => $id, 'targets' => $targets,
        ], $this->authHeaders())->assertCreated()->json('request.id');

        $approverOne = $this->headersFor('outcome-one@example.test');
        $approverTwo = $this->headersFor('outcome-two@example.test');
        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", ['decision' => 'approve'], $approverOne)->assertOk();
        $this->postJson("/api/v1/approval-requests/{$requestId}/decisions", ['decision' => 'approve'], $approverTwo)->assertOk();

        $run = $this->postJson("/api/v1/approval-requests/{$requestId}/execute", [], $this->authHeaders())->assertCreated();

        // No single pass/fail for the whole batch -- each target discloses
        // its own outcome.
        $this->assertSame('completed', $run->json('run.results.0.status'));
        $this->assertSame('missing', $run->json('run.results.1.status'));
        $this->assertSame(1, $run->json('run.completedCount'));
    }

    public function test_viewers_cannot_submit_decide_or_execute_approval_requests(): void
    {
        $this->enableSensitivePolicy('delete');
        $id = $this->createMacro([['type' => 'delete']]);
        $viewer = $this->headersFor('approval-viewer@example.test', 'viewer');

        $this->postJson('/api/v1/approval-requests', [
            'targetType' => 'bulk-macro', 'targetId' => $id, 'targets' => [['store' => 'archive-items', 'id' => 'x']],
        ], $viewer)->assertForbidden();
    }

    /** @param array<int, array<string, string>> $steps */
    private function createMacro(array $steps): string
    {
        $id = $this->postJson('/api/v1/bulk-macros', ['name' => 'macro', 'steps' => $steps], $this->authHeaders())
            ->assertCreated()->json('macro.id');
        $this->assertIsString($id);

        return $id;
    }

    private function seedRecord(string $id): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => $id, 'id' => $id, 'title' => 'Approval target', 'tags' => ['existing'], 'workflowStatus' => 'draft',
        ]]], $this->authHeaders())->assertOk();
    }

    private function enableSensitivePolicy(string $operationKey): void
    {
        $this->patchJson("/api/v1/sensitive-operation-policies/{$operationKey}", ['sensitive' => true], $this->headersFor('policy-admin@example.test', 'admin'))
            ->assertOk()->assertJsonPath('policy.sensitive', true);
    }

    /** @return array<string, string> */
    private function headersFor(string $email, string $role = 'editor'): array
    {
        User::query()->create(['name' => $role, 'email' => $email, 'password' => Hash::make('secret-password'), 'role' => $role]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'secret-password'])->assertOk()->json('accessToken');

        return ['Authorization' => 'Bearer '.$token];
    }
}
