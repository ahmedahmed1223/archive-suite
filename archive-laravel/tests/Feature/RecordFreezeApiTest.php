<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordFreezeApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_freezes_reads_and_unfreezes(): void
    {
        $this->seedRecord('item-1');

        $this->postJson('/api/v1/records/item-1/freeze', ['reason' => 'قيد المراجعة'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('freeze.recordId', 'item-1')
            ->assertJsonPath('freeze.reason', 'قيد المراجعة');

        $this->getJson('/api/v1/records/item-1/freeze', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('freeze.reason', 'قيد المراجعة');

        $this->deleteJson('/api/v1/records/item-1/freeze', [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/records/item-1/freeze', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('freeze', null);
    }

    public function test_bulk_write_to_a_frozen_record_is_blocked_at_the_api(): void
    {
        $this->seedRecord('item-1');
        $this->postJson('/api/v1/records/item-1/freeze', ['reason' => 'قيد المراجعة'], $this->authHeaders())->assertOk();

        $response = $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => 'item-1', 'title' => 'محاولة تعديل',
        ]]], $this->authHeaders())->assertOk();

        $this->assertSame(0, $response->json('count'));
        $this->assertContains('item-1', $response->json('blocked'));

        $record = $this->getJson('/api/v1/records/item-1?store=archive-items', $this->authHeaders())->assertOk();
        $this->assertNotSame('محاولة تعديل', $record->json('record.title'));
    }

    public function test_an_admin_can_still_write_to_a_frozen_record(): void
    {
        $this->seedRecord('item-1');
        $this->postJson('/api/v1/records/item-1/freeze', ['reason' => 'قيد المراجعة'], $this->authHeaders())->assertOk();

        $admin = User::query()->create(['name' => 'a', 'email' => 'admin@example.com', 'password' => Hash::make('secret-password'), 'role' => 'admin']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'admin@example.com', 'password' => 'secret-password'])->assertOk()->json('accessToken');
        $adminHeaders = ['Authorization' => 'Bearer '.$token];

        $response = $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => 'item-1', 'title' => 'تعديل المدير',
        ]]], $adminHeaders)->assertOk();

        $this->assertSame(1, $response->json('count'));
        $this->assertSame([], $response->json('blocked'));
    }

    private function seedRecord(string $id): void
    {
        $this->postJson('/api/v1/records/bulk', ['store' => 'archive-items', 'records' => [[
            'uid' => $id, 'id' => $id, 'title' => 'Record '.$id,
        ]]], $this->authHeaders())->assertOk();
    }
}
