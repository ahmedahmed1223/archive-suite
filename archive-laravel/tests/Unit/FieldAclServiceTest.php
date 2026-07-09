<?php

namespace Tests\Unit;

use App\Services\FieldAclService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FieldAclServiceTest extends RefreshDatabase
{
    protected FieldAclService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new FieldAclService();
    }

    public function test_get_field_acl_returns_empty_for_nonexistent_type(): void
    {
        $acl = $this->service->getFieldAcl('nonexistent');
        $this->assertEmpty($acl);
    }

    public function test_get_field_acl_returns_rules_for_type(): void
    {
        $typeData = [
            'id' => 'test-type',
            'name' => 'Test Type',
            'fields' => [
                [
                    'name' => 'public_field',
                    'type' => 'text',
                    'fieldAcl' => ['view' => [], 'edit' => []],
                ],
                [
                    'name' => 'admin_only',
                    'type' => 'text',
                    'fieldAcl' => ['view' => ['admin'], 'edit' => ['admin']],
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'test-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $acl = $this->service->getFieldAcl('test-type');

        $this->assertArrayHasKey('public_field', $acl);
        $this->assertArrayHasKey('admin_only', $acl);
        $this->assertEmpty($acl['public_field']['view']);
        $this->assertContains('admin', $acl['admin_only']['view']);
    }

    public function test_can_view_field_returns_true_for_allowed_role(): void
    {
        $typeData = [
            'id' => 'test-type',
            'name' => 'Test Type',
            'fields' => [
                [
                    'name' => 'editor_visible',
                    'type' => 'text',
                    'fieldAcl' => ['view' => ['editor', 'admin'], 'edit' => ['admin']],
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'test-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue($this->service->canViewField('test-type', 'editor_visible', 'editor'));
        $this->assertTrue($this->service->canViewField('test-type', 'editor_visible', 'admin'));
        $this->assertFalse($this->service->canViewField('test-type', 'editor_visible', 'viewer'));
    }

    public function test_can_view_field_returns_true_for_unrestricted_field(): void
    {
        $typeData = [
            'id' => 'test-type',
            'name' => 'Test Type',
            'fields' => [
                [
                    'name' => 'public_field',
                    'type' => 'text',
                    // No fieldAcl = public
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'test-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue($this->service->canViewField('test-type', 'public_field', 'viewer'));
    }

    public function test_can_edit_field_enforces_edit_rules(): void
    {
        $typeData = [
            'id' => 'test-type',
            'name' => 'Test Type',
            'fields' => [
                [
                    'name' => 'editor_only',
                    'type' => 'text',
                    'fieldAcl' => ['view' => ['viewer', 'editor', 'admin'], 'edit' => ['editor', 'admin']],
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'test-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue($this->service->canEditField('test-type', 'editor_only', 'editor'));
        $this->assertTrue($this->service->canEditField('test-type', 'editor_only', 'admin'));
        $this->assertFalse($this->service->canEditField('test-type', 'editor_only', 'viewer'));
    }

    public function test_filter_visible_fields_removes_restricted_fields(): void
    {
        $typeData = [
            'id' => 'test-type',
            'name' => 'Test Type',
            'fields' => [
                [
                    'name' => 'title',
                    'type' => 'text',
                    'fieldAcl' => ['view' => [], 'edit' => []],
                ],
                [
                    'name' => 'admin_notes',
                    'type' => 'text',
                    'fieldAcl' => ['view' => ['admin'], 'edit' => ['admin']],
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'test-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $record = [
            'id' => '123',
            'title' => 'Test Title',
            'admin_notes' => 'Secret notes',
        ];

        $filtered = $this->service->filterVisibleFields('test-type', $record, 'viewer');

        $this->assertArrayHasKey('id', $filtered);
        $this->assertArrayHasKey('title', $filtered);
        $this->assertArrayNotHasKey('admin_notes', $filtered);
    }

    public function test_validate_edit_permissions_returns_denied_fields(): void
    {
        $typeData = [
            'id' => 'test-type',
            'name' => 'Test Type',
            'fields' => [
                [
                    'name' => 'title',
                    'type' => 'text',
                    'fieldAcl' => ['view' => [], 'edit' => []],
                ],
                [
                    'name' => 'restricted_field',
                    'type' => 'text',
                    'fieldAcl' => ['view' => ['admin'], 'edit' => ['admin']],
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'test-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $deniedFields = $this->service->validateEditPermissions(
            'test-type',
            ['title' => 'New Title', 'restricted_field' => 'Secret'],
            'viewer'
        );

        $this->assertCount(1, $deniedFields);
        $this->assertContains('restricted_field', $deniedFields);
        $this->assertNotContains('title', $deniedFields);
    }

    public function test_validate_edit_permissions_allows_all_fields_for_unrestricted_type(): void
    {
        $typeData = [
            'id' => 'test-type',
            'name' => 'Test Type',
            'fields' => [
                [
                    'name' => 'title',
                    'type' => 'text',
                ],
                [
                    'name' => 'description',
                    'type' => 'text',
                ],
            ],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'test-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $deniedFields = $this->service->validateEditPermissions(
            'test-type',
            ['title' => 'New Title', 'description' => 'New Description'],
            'viewer'
        );

        $this->assertEmpty($deniedFields);
    }

    public function test_system_fields_are_never_filtered(): void
    {
        $typeData = [
            'id' => 'test-type',
            'name' => 'Test Type',
            'fields' => [],
        ];

        DB::table('storage_rows')->insert([
            'store' => 'types',
            'uid' => 'test-type',
            'data' => json_encode($typeData),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $record = [
            'id' => '123',
            'uid' => 'abc',
            'createdAt' => '2026-07-09',
            'updatedAt' => '2026-07-09',
            '_internal' => 'hidden',
        ];

        $filtered = $this->service->filterVisibleFields('test-type', $record, 'viewer');

        $this->assertArrayHasKey('id', $filtered);
        $this->assertArrayHasKey('uid', $filtered);
        $this->assertArrayHasKey('createdAt', $filtered);
        $this->assertArrayHasKey('updatedAt', $filtered);
        $this->assertArrayHasKey('_internal', $filtered);
    }
}
