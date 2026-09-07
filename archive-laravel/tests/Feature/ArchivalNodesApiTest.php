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
}
