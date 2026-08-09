<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class DepartmentRoutingApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    public function test_routes_once_and_blocks_a_cycle(): void
    {
        $id = $this->postJson('/api/v1/inbox', ['title' => 'وارد'], $this->authHeaders())->assertCreated()->json('item.id');
        $this->postJson("/api/v1/inbox/{$id}/department-routing/preview", ['departmentId' => 'news'], $this->authHeaders())->assertOk()->assertJsonPath('blocked', false);
        $this->postJson("/api/v1/inbox/{$id}/department-routing", ['departmentId' => 'news'], $this->authHeaders())->assertOk()->assertJsonPath('departmentId', 'news');
        $this->getJson('/api/v1/inbox', $this->authHeaders())->assertOk()->assertJsonPath('items.0.departmentId', 'news')->assertJsonCount(1, 'items.0.routingHistory');
        $this->postJson("/api/v1/inbox/{$id}/department-routing", ['departmentId' => 'news'], $this->authHeaders())->assertUnprocessable()->assertJsonPath('blocked', true);
    }
}
