<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TypesControllerTest extends RefreshDatabase
{
    protected User $adminUser;
    protected User $editorUser;
    protected User $viewerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::factory()->create(['role' => 'admin']);
        $this->editorUser = User::factory()->create(['role' => 'editor']);
        $this->viewerUser = User::factory()->create(['role' => 'viewer']);
    }

    public function test_create_type_with_field_acl(): void
    {
        $payload = [
            'id' => 'article-type',
            'name' => 'Article',
            'fields' => [
                [
                    'name' => 'title',
                    'type' => 'text',
                    'fieldAcl' => [
                        'view' => ['viewer', 'editor', 'admin'],
                        'edit' => ['editor', 'admin'],
                    ],
                ],
                [
                    'name' => 'internal_notes',
                    'type' => 'text',
                    'fieldAcl' => [
                        'view' => ['admin'],
                        'edit' => ['admin'],
                    ],
                ],
            ],
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/v1/types', $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('type.id', 'article-type');
        $response->assertJsonPath('type.name', 'Article');

        // Verify stored in database
        $row = DB::table('storage_rows')
            ->where('store', 'types')
            ->where('uid', 'article-type')
            ->first();

        $this->assertNotNull($row);
        $data = json_decode($row->data, true);
        $this->assertCount(2, $data['fields']);
    }

    public function test_get_type_definition(): void
    {
        $typeData = [
            'id' => 'video-type',
            'name' => 'Video',
            'fields' => [
                [
                    'name' => 'title',
                    'type' => 'text',
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'video-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($this->adminUser)->getJson('/api/v1/types/video-type');

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('type.id', 'video-type');
    }

    public function test_check_field_acl_viewer_cannot_edit_admin_only_field(): void
    {
        $typeData = [
            'id' => 'document-type',
            'name' => 'Document',
            'fields' => [
                [
                    'name' => 'content',
                    'type' => 'text',
                    'fieldAcl' => [
                        'view' => ['admin'],
                        'edit' => ['admin'],
                    ],
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'document-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($this->viewerUser)->postJson(
            '/api/v1/types/document-type/check-field-acl',
            ['fieldName' => 'content']
        );

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('canView', false);
        $response->assertJsonPath('canEdit', false);
        $response->assertJsonPath('userRole', 'viewer');
    }

    public function test_check_field_acl_editor_can_edit_public_field(): void
    {
        $typeData = [
            'id' => 'article-type',
            'name' => 'Article',
            'fields' => [
                [
                    'name' => 'title',
                    'type' => 'text',
                    'fieldAcl' => [
                        'view' => [],  // Empty = everyone can view
                        'edit' => [],  // Empty = everyone can edit
                    ],
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'article-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($this->editorUser)->postJson(
            '/api/v1/types/article-type/check-field-acl',
            ['fieldName' => 'title']
        );

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('canView', true);
        $response->assertJsonPath('canEdit', true);
    }

    public function test_check_field_acl_nonexistent_type_returns_404(): void
    {
        $response = $this->actingAs($this->adminUser)->postJson(
            '/api/v1/types/nonexistent/check-field-acl',
            ['fieldName' => 'title']
        );

        $response->assertStatus(404);
        $response->assertJsonPath('ok', false);
    }

    public function test_list_types_with_pagination(): void
    {
        for ($i = 1; $i <= 3; $i++) {
            DB::table('storage_rows')->insert([
                'store' => 'types',
                'uid' => "type-$i",
                'data' => json_encode([
                    'id' => "type-$i",
                    'name' => "Type $i",
                    'fields' => [],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $response = $this->actingAs($this->adminUser)->getJson('/api/v1/types?limit=2');

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $this->assertCount(2, $response->json('types'));
        $this->assertNotNull($response->json('nextCursor'));
    }
}
