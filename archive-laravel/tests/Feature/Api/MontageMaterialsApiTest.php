<?php

namespace Tests\Feature\Api;

use App\Models\MontageProject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MontageMaterialsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_editor_receives_version_pinned_media_materials(): void
    {
        $editor = User::factory()->create(['role' => 'editor']);
        $project = MontageProject::factory()->create(['owner_id' => $editor->id]);
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => 'interview-01',
            'data' => json_encode([
                'fileName' => 'interview.mov',
                'filePath' => 'media/interview.mov',
                'checksum' => 'source-checksum',
                'durationSeconds' => 42.5,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($editor)
            ->getJson("/api/v1/montage-projects/{$project->id}/materials")
            ->assertOk()
            ->assertJsonPath('materials.0.id', 'interview-01')
            ->assertJsonPath('materials.0.durationSeconds', 42.5)
            ->assertJsonPath('materials.0.source.recordId', 'interview-01')
            ->assertJsonPath('materials.0.source.sourceVersionToken', 'record:source-checksum');
    }
}
