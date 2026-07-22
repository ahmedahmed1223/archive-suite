<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TypesControllerTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_create_type_persists_icon_identifier(): void
    {
        $payload = [
            'id' => 'photo-type',
            'name' => 'Photo',
            'icon' => 'Image',
            'fields' => [['name' => 'title', 'type' => 'text']],
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/v1/types', $payload);

        $response->assertCreated()->assertJsonPath('type.icon', 'Image');
        $this->actingAs($this->viewerUser)
            ->getJson('/api/v1/types/photo-type')
            ->assertOk()
            ->assertJsonPath('type.icon', 'Image');
    }

    public function test_updating_type_persists_icon_identifier(): void
    {
        $this->actingAs($this->adminUser)->postJson('/api/v1/types', [
            'id' => 'photo-type',
            'name' => 'Photo',
            'icon' => 'Image',
            'fields' => [['name' => 'title', 'type' => 'text']],
        ])->assertCreated();

        $this->actingAs($this->adminUser)->postJson('/api/v1/types', [
            'id' => 'photo-type',
            'name' => 'Photo',
            'icon' => 'Camera',
            'fields' => [['name' => 'title', 'type' => 'text']],
        ])->assertOk()->assertJsonPath('type.icon', 'Camera');

        $this->actingAs($this->viewerUser)
            ->getJson('/api/v1/types/photo-type')
            ->assertOk()
            ->assertJsonPath('type.icon', 'Camera');
    }

    public function test_create_type_preserves_null_field_acl(): void
    {
        $response = $this->actingAs($this->adminUser)->postJson('/api/v1/types', [
            'id' => 'nullable-acl-type',
            'name' => 'Nullable ACL',
            'fields' => [['name' => 'title', 'type' => 'text', 'fieldAcl' => null]],
        ]);

        $response->assertCreated()->assertJsonPath('type.fields.0.fieldAcl', null);
        $this->actingAs($this->viewerUser)
            ->getJson('/api/v1/types/nullable-acl-type')
            ->assertOk()
            ->assertJsonPath('type.fields.0.fieldAcl', null);
    }

    public function test_create_type_preserves_null_field_acl_permissions(): void
    {
        $response = $this->actingAs($this->adminUser)->postJson('/api/v1/types', [
            'id' => 'nullable-acl-permissions-type',
            'name' => 'Nullable ACL Permissions',
            'fields' => [[
                'name' => 'title',
                'type' => 'text',
                'fieldAcl' => ['view' => null, 'edit' => null],
            ]],
        ]);

        $response->assertCreated()
            ->assertJsonPath('type.fields.0.fieldAcl.view', null)
            ->assertJsonPath('type.fields.0.fieldAcl.edit', null);
        $this->actingAs($this->viewerUser)
            ->getJson('/api/v1/types/nullable-acl-permissions-type')
            ->assertOk()
            ->assertJsonPath('type.fields.0.fieldAcl.view', null)
            ->assertJsonPath('type.fields.0.fieldAcl.edit', null);
    }

    public function test_create_type_rejects_invalid_icon_identifier(): void
    {
        $payload = [
            'id' => 'bad-icon-type',
            'name' => 'Bad Icon',
            'icon' => str_repeat('x', 101),
            'fields' => [['name' => 'title', 'type' => 'text']],
        ];

        $this->actingAs($this->adminUser)
            ->postJson('/api/v1/types', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['icon']);
    }

    public function test_create_type_rejects_null_icon_identifier(): void
    {
        $this->actingAs($this->adminUser)
            ->postJson('/api/v1/types', [
                'id' => 'null-icon-type',
                'name' => 'Null Icon',
                'icon' => null,
                'fields' => [['name' => 'title', 'type' => 'text']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['icon']);
    }

    public function test_create_type_rejects_empty_identifier(): void
    {
        $this->actingAs($this->adminUser)
            ->postJson('/api/v1/types', [
                'id' => '',
                'name' => 'Valid Name',
                'fields' => [['name' => 'title', 'type' => 'text']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['id']);
    }

    public function test_create_type_rejects_empty_name(): void
    {
        $this->actingAs($this->adminUser)
            ->postJson('/api/v1/types', [
                'id' => 'empty-name-type',
                'name' => '',
                'fields' => [['name' => 'title', 'type' => 'text']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_create_type_rejects_empty_field_name(): void
    {
        $this->actingAs($this->adminUser)
            ->postJson('/api/v1/types', [
                'id' => 'empty-field-name-type',
                'name' => 'Empty Field Name',
                'fields' => [['name' => '', 'type' => 'text']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['fields.0.name']);
    }

    public function test_create_type_with_conditional_field(): void
    {
        $payload = [
            'id' => 'licensed-asset-type',
            'name' => 'Licensed Asset',
            'fields' => [
                [
                    'name' => 'hasLicense',
                    'type' => 'boolean',
                ],
                [
                    'name' => 'licenseNumber',
                    'type' => 'text',
                    'condition' => [
                        'field' => 'hasLicense',
                        'equals' => true,
                    ],
                ],
            ],
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/v1/types', $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('type.fields.1.condition.field', 'hasLicense');
        $response->assertJsonPath('type.fields.1.condition.equals', true);
    }

    public function test_create_type_rejects_condition_referencing_own_field(): void
    {
        $payload = [
            'id' => 'self-reference-type',
            'name' => 'Self Reference',
            'fields' => [
                [
                    'name' => 'hasLicense',
                    'type' => 'boolean',
                    'condition' => [
                        'field' => 'hasLicense',
                        'equals' => true,
                    ],
                ],
            ],
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/v1/types', $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['fields.0.condition.field']);
    }

    public function test_create_type_rejects_condition_field_longer_than_255_characters(): void
    {
        $longFieldName = str_repeat('a', 256);

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/v1/types', [
                'id' => 'long-condition-field-type',
                'name' => 'Long Condition Field',
                'fields' => [
                    ['name' => $longFieldName, 'type' => 'boolean'],
                    [
                        'name' => 'dependent',
                        'type' => 'text',
                        'condition' => ['field' => $longFieldName, 'equals' => true],
                    ],
                ],
            ]);

        // The reference exists; without the condition max rule only fields.0.name would fail.
        $response->assertUnprocessable()->assertJsonValidationErrors(['fields.1.condition.field']);
        $errors = $response->json('errors');
        $this->assertStringContainsString('255', $errors['fields.1.condition.field'][0]);
    }

    public function test_create_type_rejects_condition_referencing_unknown_field(): void
    {
        $payload = [
            'id' => 'unknown-reference-type',
            'name' => 'Unknown Reference',
            'fields' => [
                [
                    'name' => 'licenseNumber',
                    'type' => 'text',
                    'condition' => [
                        'field' => 'hasLicense',
                        'equals' => true,
                    ],
                ],
            ],
        ];

        $response = $this->actingAs($this->adminUser)->postJson('/api/v1/types', $payload);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['fields.0.condition.field']);
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
                    ...($i === 1 ? ['icon' => 'FileText'] : []),
                    'fields' => [],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $response = $this->actingAs($this->adminUser)->getJson('/api/v1/types?limit=2');

        $response->assertStatus(200);
        $response->assertJsonPath('ok', true);
        $response->assertJsonPath('types.0.icon', 'FileText');
        $response->assertJsonMissingPath('types.1.icon');
        $this->assertCount(2, $response->json('types'));
        $this->assertNotNull($response->json('nextCursor'));
    }
}
