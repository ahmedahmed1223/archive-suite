<?php

namespace Tests\Feature\Api\V1;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TagNodesControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        // Create a test user for auth
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    public function test_can_create_tag_node_with_color(): void
    {
        $response = $this->postJson('/api/v1/tag-nodes', [
            'tag' => 'important',
            'parent' => '',
            'color' => '#FF0000',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('node.tag', 'important');
        $response->assertJsonPath('node.color', '#FF0000');
        $response->assertJsonPath('node.order', 0);
    }

    public function test_can_reorder_tags(): void
    {
        $id1 = $this->createTagNode('tag1', '');
        $id2 = $this->createTagNode('tag2', '');
        $id3 = $this->createTagNode('tag3', '');

        $response = $this->postJson('/api/v1/tag-nodes/reorder', [
            'order' => [
                ['id' => $id3, 'order_index' => 0],
                ['id' => $id1, 'order_index' => 1],
                ['id' => $id2, 'order_index' => 2],
            ],
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('updated', 3);

        $this->assertDatabaseHas('tag_nodes', [
            'id' => $id1,
            'order_index' => 1,
        ]);
    }

    public function test_can_merge_tags(): void
    {
        $parentId = $this->createTagNode('parent', '');
        $childId = $this->createTagNode('child', 'parent');
        $mergeId = $this->createTagNode('merge-me', '');

        $response = $this->postJson(
            "/api/v1/tag-nodes/{$mergeId}/merge",
            ['mergeInto' => $parentId]
        );

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('merged', true);

        // Verify merge-me node is deleted
        $this->assertDatabaseMissing('tag_nodes', ['id' => $mergeId]);
    }

    public function test_cannot_merge_tag_into_itself(): void
    {
        $id = $this->createTagNode('tag', '');

        $response = $this->postJson("/api/v1/tag-nodes/{$id}/merge", ['mergeInto' => $id]);

        $response->assertStatus(400);
        $response->assertJsonPath('ok', false);
    }

    public function test_can_move_tag_with_children(): void
    {
        $oldParentId = $this->createTagNode('old-parent', '');
        $newParentId = $this->createTagNode('new-parent', '');
        $tagId = $this->createTagNode('tag', 'old-parent');
        $childId = $this->createTagNode('child', 'tag');

        $response = $this->postJson(
            "/api/v1/tag-nodes/{$tagId}/move",
            ['parent' => 'new-parent', 'deleteChildren' => false]
        );

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('moved', true);

        // Verify tag was moved
        $this->assertDatabaseHas('tag_nodes', [
            'id' => $tagId,
            'parent' => 'new-parent',
        ]);

        // Verify child was also moved
        $this->assertDatabaseHas('tag_nodes', [
            'id' => $childId,
            'parent' => 'tag',
        ]);
    }

    public function test_can_move_tag_and_delete_children(): void
    {
        $parentId = $this->createTagNode('parent', '');
        $tagId = $this->createTagNode('tag', 'parent');
        $childId = $this->createTagNode('child', 'tag');

        $response = $this->postJson(
            "/api/v1/tag-nodes/{$tagId}/move",
            ['parent' => '', 'deleteChildren' => true]
        );

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);

        // Verify child was deleted
        $this->assertDatabaseMissing('tag_nodes', ['id' => $childId]);

        // Verify tag was moved
        $this->assertDatabaseHas('tag_nodes', [
            'id' => $tagId,
            'parent' => '',
        ]);
    }

    public function test_prevents_circular_hierarchy(): void
    {
        $parentId = $this->createTagNode('parent', '');
        $childId = $this->createTagNode('child', 'parent');

        $response = $this->postJson(
            "/api/v1/tag-nodes/{$parentId}/move",
            ['parent' => 'child']
        );

        $response->assertStatus(400);
        $response->assertJsonPath('ok', false);
    }

    public function test_can_update_tag_color(): void
    {
        $id = $this->createTagNode('tag', '');

        $response = $this->patchJson("/api/v1/tag-nodes/{$id}", [
            'color' => '#00FF00',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('node.color', '#00FF00');
    }

    public function test_rejects_invalid_color_format(): void
    {
        $response = $this->postJson('/api/v1/tag-nodes', [
            'tag' => 'tag',
            'parent' => '',
            'color' => 'invalid-color',
        ]);

        $response->assertStatus(422);
    }

    private function createTagNode(string $tag, string $parent = ''): string
    {
        $id = (string) \Illuminate\Support\Str::uuid();
        DB::table('tag_nodes')->insert([
            'id' => $id,
            'user_id' => $this->user->id,
            'tag' => $tag,
            'parent' => $parent,
            'order_index' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }
}
