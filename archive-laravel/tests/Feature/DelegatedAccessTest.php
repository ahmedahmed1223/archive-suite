<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\DelegatedAccess;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * V1-726: an editor/admin can grant a colleague (any role) temporary
 * editor-level access to a specific set of records, which auto-expires
 * without changing that colleague's global role.
 */
class DelegatedAccessTest extends TestCase
{
    use RefreshDatabase;

    private function seedArchiveRecord(string $uid): void
    {
        $now = now();

        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode(['uid' => $uid, 'id' => $uid, 'title' => "Record $uid", 'type' => 'video'], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /** @return array{headers: array<string, string>, user: User} */
    private function actorFor(string $role, string $name, string $email): array
    {
        $user = User::query()->create(['name' => $name, 'email' => $email, 'password' => Hash::make('secret-password'), 'role' => $role]);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'secret-password'])->assertOk()->json('accessToken');

        return ['headers' => ['Authorization' => 'Bearer '.$token], 'user' => $user];
    }

    public function test_editor_can_delegate_temporary_editor_access_to_a_viewer(): void
    {
        $editor = $this->actorFor('editor', 'محرر مانح', 'grantor@example.test');
        $viewer = $this->actorFor('viewer', 'زميل مؤقت', 'grantee@example.test');
        $this->seedArchiveRecord('item-delegate-1');

        $response = $this->postJson('/api/v1/delegated-access', [
            'granteeId' => $viewer['user']->id,
            'scope' => ['itemIds' => ['item-delegate-1']],
            'expiresAt' => now()->addDay()->toIso8601String(),
        ], $editor['headers'])->assertCreated();

        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('delegation.status', 'active');
        $response->assertJsonPath('delegation.permission', 'editor');
        $this->assertSame(1, DelegatedAccess::query()->count());
    }

    public function test_viewer_cannot_grant_delegated_access(): void
    {
        $viewer = $this->actorFor('viewer', 'مشاهد', 'viewer-grantor@example.test');
        $other = $this->actorFor('viewer', 'زميل آخر', 'other-viewer@example.test');

        $this->postJson('/api/v1/delegated-access', [
            'granteeId' => $other['user']->id,
            'scope' => ['itemIds' => ['item-x']],
            'expiresAt' => now()->addDay()->toIso8601String(),
        ], $viewer['headers'])->assertForbidden();
    }

    public function test_cannot_delegate_access_to_yourself(): void
    {
        $editor = $this->actorFor('editor', 'محرر منفرد', 'self-delegate@example.test');

        $this->postJson('/api/v1/delegated-access', [
            'granteeId' => $editor['user']->id,
            'scope' => ['itemIds' => ['item-x']],
            'expiresAt' => now()->addDay()->toIso8601String(),
        ], $editor['headers'])->assertStatus(422);
    }

    public function test_delegated_viewer_can_bulk_save_only_the_scoped_item(): void
    {
        $editor = $this->actorFor('editor', 'مانح الصلاحية', 'grantor-bulk@example.test');
        $viewer = $this->actorFor('viewer', 'مستفيد الصلاحية', 'grantee-bulk@example.test');
        $this->seedArchiveRecord('item-scoped');
        $this->seedArchiveRecord('item-out-of-scope');

        $this->postJson('/api/v1/delegated-access', [
            'granteeId' => $viewer['user']->id,
            'scope' => ['itemIds' => ['item-scoped']],
            'expiresAt' => now()->addDay()->toIso8601String(),
        ], $editor['headers'])->assertCreated();

        // In scope: allowed.
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'item-scoped', 'title' => 'Updated by delegate']],
        ], $viewer['headers'])->assertOk();

        // Not in scope: still forbidden even with an active delegation elsewhere.
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'item-out-of-scope', 'title' => 'Should not be allowed']],
        ], $viewer['headers'])->assertForbidden();
    }

    public function test_expired_delegation_no_longer_grants_access(): void
    {
        $editor = $this->actorFor('editor', 'مانح منتهي', 'grantor-expired@example.test');
        $viewer = $this->actorFor('viewer', 'مستفيد منتهي', 'grantee-expired@example.test');
        $this->seedArchiveRecord('item-expiring');

        $this->postJson('/api/v1/delegated-access', [
            'granteeId' => $viewer['user']->id,
            'scope' => ['itemIds' => ['item-expiring']],
            'expiresAt' => now()->addMinute()->toIso8601String(),
        ], $editor['headers'])->assertCreated();

        $this->travel(2)->minutes();

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'item-expiring', 'title' => 'Too late']],
        ], $viewer['headers'])->assertForbidden();
    }

    public function test_grantor_can_revoke_a_delegation_before_it_expires(): void
    {
        $editor = $this->actorFor('editor', 'مانح راجع', 'grantor-revoke@example.test');
        $viewer = $this->actorFor('viewer', 'مستفيد راجع', 'grantee-revoke@example.test');
        $this->seedArchiveRecord('item-revoked');

        $created = $this->postJson('/api/v1/delegated-access', [
            'granteeId' => $viewer['user']->id,
            'scope' => ['itemIds' => ['item-revoked']],
            'expiresAt' => now()->addDay()->toIso8601String(),
        ], $editor['headers'])->assertCreated()->json('delegation.id');

        $this->deleteJson("/api/v1/delegated-access/{$created}", [], $editor['headers'])
            ->assertOk()
            ->assertJsonPath('delegation.status', 'revoked');

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [['uid' => 'item-revoked', 'title' => 'Revoked already']],
        ], $viewer['headers'])->assertForbidden();
    }

    public function test_index_splits_granted_and_received_delegations(): void
    {
        $editor = $this->actorFor('editor', 'مانح قائمة', 'grantor-list@example.test');
        $viewer = $this->actorFor('viewer', 'مستفيد قائمة', 'grantee-list@example.test');
        $this->seedArchiveRecord('item-list-1');

        $this->postJson('/api/v1/delegated-access', [
            'granteeId' => $viewer['user']->id,
            'scope' => ['itemIds' => ['item-list-1']],
            'expiresAt' => now()->addDay()->toIso8601String(),
        ], $editor['headers'])->assertCreated();

        $granted = $this->getJson('/api/v1/delegated-access?direction=granted', $editor['headers'])->assertOk();
        $this->assertCount(1, $granted->json('delegations'));

        $received = $this->getJson('/api/v1/delegated-access?direction=received', $viewer['headers'])->assertOk();
        $this->assertCount(1, $received->json('delegations'));

        $grantorHasNoneReceived = $this->getJson('/api/v1/delegated-access?direction=received', $editor['headers'])->assertOk();
        $this->assertCount(0, $grantorHasNoneReceived->json('delegations'));
    }
}
