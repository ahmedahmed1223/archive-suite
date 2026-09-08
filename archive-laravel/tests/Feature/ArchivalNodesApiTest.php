<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class ArchivalNodesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests;
    use RefreshDatabase;

    public function test_it_builds_an_institutional_hierarchy_without_reusing_smart_collections(): void
    {
        $fonds = $this->postJson('/api/v1/archival-nodes', [
            'title' => 'أرشيف الأخبار',
            'level' => 'fonds',
            'referenceCode' => 'NEWS',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('node.level', 'fonds')
            ->assertJsonPath('node.parentId', null);

        $parentId = $fonds->json('node.id');
        $series = $this->postJson('/api/v1/archival-nodes', [
            'title' => 'النشرة المسائية',
            'level' => 'series',
            'parentId' => $parentId,
            'referenceCode' => 'NEWS-EVE',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('node.parentId', $parentId);

        $this->getJson('/api/v1/archival-nodes', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'nodes')
            ->assertJsonPath('nodes.1.path.0.id', $parentId);

        $this->postJson("/api/v1/archival-nodes/{$parentId}/move-preview", [
            'parentId' => $series->json('node.id'),
        ], $this->authHeaders())
            ->assertUnprocessable()
            ->assertJsonPath('code', 'cycle_detected');
    }

    public function test_it_applies_a_previously_validated_move_and_returns_the_new_path(): void
    {
        $fonds = $this->postJson('/api/v1/archival-nodes', ['title' => 'أرشيف الأخبار', 'level' => 'fonds'], $this->authHeaders())->assertCreated();
        $series = $this->postJson('/api/v1/archival-nodes', ['title' => 'النشرة المسائية', 'level' => 'series', 'parentId' => $fonds->json('node.id')], $this->authHeaders())->assertCreated();
        $target = $this->postJson('/api/v1/archival-nodes', ['title' => 'أرشيف البرامج', 'level' => 'fonds'], $this->authHeaders())->assertCreated();

        $this->postJson('/api/v1/archival-nodes/'.$series->json('node.id').'/move-preview', ['parentId' => $target->json('node.id')], $this->authHeaders())
            ->assertOk()->assertJsonPath('preview.affectedDescendantCount', 0);

        $this->postJson('/api/v1/archival-nodes/'.$series->json('node.id').'/move', ['parentId' => $target->json('node.id')], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('node.parentId', $target->json('node.id'))
            ->assertJsonPath('node.path.0.id', $target->json('node.id'));
    }
}
