<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * V3-WORK-002: named archive/review/production presets for
 * ProjectTasksController::store(). A template supplies a default title and
 * an optional target duration (minutes from creation); applying one is just
 * copying those fields into the existing POST /project-tasks call.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_task_templates', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('category')->index(); // archive | review | production
            $table->string('title', 300);
            $table->text('description')->nullable();
            $table->string('default_status', 30)->default('todo');
            $table->unsignedInteger('target_duration_minutes')->nullable();
            $table->timestamps();
        });

        $now = now();
        DB::table('project_task_templates')->insert([
            [
                'id' => (string) Str::uuid(),
                'category' => 'archive',
                'title' => 'Archive intake review',
                'description' => 'Verify metadata and file integrity for a newly archived item.',
                'default_status' => 'todo',
                'target_duration_minutes' => 2 * 24 * 60,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => (string) Str::uuid(),
                'category' => 'review',
                'title' => 'Editorial review',
                'description' => 'Review content and approve or request changes.',
                'default_status' => 'review',
                'target_duration_minutes' => 24 * 60,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => (string) Str::uuid(),
                'category' => 'production',
                'title' => 'Production handoff',
                'description' => 'Prepare the record for broadcast/production delivery.',
                'default_status' => 'in_progress',
                'target_duration_minutes' => 4 * 60,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('project_task_templates');
    }
};
