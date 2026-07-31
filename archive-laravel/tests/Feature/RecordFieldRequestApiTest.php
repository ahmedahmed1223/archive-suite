<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class RecordFieldRequestApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_lists_resolves_and_deletes_a_request(): void
    {
        $created = $this->postJson('/api/v1/records/item-1/field-requests', [
            'field' => 'rightsHolder',
            'message' => 'من يملك حقوق هذه المادة؟',
            'assignee' => 'ahmed@example.com',
            'dueDate' => '2026-08-15',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('request.field', 'rightsHolder')
            ->assertJsonPath('request.assignee', 'ahmed@example.com')
            ->assertJsonPath('request.resolvedAt', null);

        $id = $created->json('request.id');

        $this->getJson('/api/v1/records/item-1/field-requests', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('requests.0.id', $id);

        $this->postJson("/api/v1/field-requests/{$id}/resolve", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('request.resolvedAt', fn ($value) => $value !== null);

        $this->deleteJson("/api/v1/field-requests/{$id}", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);

        $this->getJson('/api/v1/records/item-1/field-requests', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'requests');
    }

    public function test_open_endpoint_excludes_resolved_requests_and_filters_by_assignee(): void
    {
        $r1 = $this->postJson('/api/v1/records/item-1/field-requests', [
            'field' => 'title', 'message' => 'x', 'assignee' => 'a@example.com',
        ], $this->authHeaders())->json('request.id');
        $this->postJson('/api/v1/records/item-2/field-requests', [
            'field' => 'title', 'message' => 'y', 'assignee' => 'b@example.com',
        ], $this->authHeaders());
        $this->postJson("/api/v1/field-requests/{$r1}/resolve", [], $this->authHeaders());

        $this->getJson('/api/v1/field-requests', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'requests')
            ->assertJsonPath('requests.0.assignee', 'b@example.com');

        $this->getJson('/api/v1/field-requests?assignee=b@example.com', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'requests');

        $this->getJson('/api/v1/field-requests?assignee=nobody@example.com', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(0, 'requests');
    }

    public function test_it_rejects_an_empty_message(): void
    {
        $this->postJson('/api/v1/records/item-1/field-requests', ['field' => 'title', 'message' => ''], $this->authHeaders())
            ->assertStatus(422);
    }

    public function test_it_assigns_the_department_field_owner_without_blocking_an_explicit_assignee(): void
    {
        $this->putJson('/api/v1/department-field-owners', ['departmentId' => 'news', 'owners' => [['field' => 'rightsHolder', 'owner' => 'rights@example.com'], ['field' => '*', 'owner' => 'desk@example.com']]], $this->authHeaders())->assertOk();
        $this->postJson('/api/v1/records/item-1/field-requests', ['field' => 'rightsHolder', 'message' => 'مطلوب', 'departmentId' => 'news'], $this->authHeaders())->assertCreated()->assertJsonPath('request.fieldOwner', 'rights@example.com')->assertJsonPath('request.assignee', 'rights@example.com');
        $this->postJson('/api/v1/records/item-1/field-requests', ['field' => 'summary', 'message' => 'مطلوب', 'departmentId' => 'news', 'assignee' => 'editor@example.com'], $this->authHeaders())->assertCreated()->assertJsonPath('request.fieldOwner', 'desk@example.com')->assertJsonPath('request.assignee', 'editor@example.com');
    }

    public function test_resolving_an_unknown_request_returns_not_found(): void
    {
        $this->postJson('/api/v1/field-requests/unknown/resolve', [], $this->authHeaders())->assertStatus(404);
    }
}
