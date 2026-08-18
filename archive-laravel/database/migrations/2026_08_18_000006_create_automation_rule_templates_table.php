<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * V3-WORK-002: named presets for AutomationRulesController::store(). A
 * template row mirrors CreateAutomationRuleRequest's shape 1:1 (trigger,
 * conditions, action) so applying one is just copying its fields into a
 * normal create-rule call - no second rule-running engine, just a labeled
 * starting point for AutomationRuleRunner's existing matching/execution
 * path.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_rule_templates', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('category')->index(); // archive | review | production
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('trigger');
            $table->json('conditions')->default('{}');
            $table->string('action');
            $table->timestamps();
        });

        $now = now();
        $emptyConditions = json_encode([
            'query' => '', 'type' => '', 'tag' => '', 'status' => '', 'fileExtension' => '', 'departmentId' => '',
        ]);

        DB::table('automation_rule_templates')->insert([
            [
                'id' => (string) Str::uuid(),
                'category' => 'archive',
                'name' => 'Tag newly archived records',
                'description' => 'Tags every newly created record for later triage.',
                'trigger' => 'record.created',
                'conditions' => $emptyConditions,
                'action' => 'add-tag',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => (string) Str::uuid(),
                'category' => 'review',
                'name' => 'Send updated records to review',
                'description' => 'Moves any updated record into the review workflow status.',
                'trigger' => 'record.updated',
                'conditions' => $emptyConditions,
                'action' => 'set-review',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => (string) Str::uuid(),
                'category' => 'production',
                'name' => 'Daily production follow-up sweep',
                'description' => 'Creates a follow-up inbox item every day for matching records.',
                'trigger' => 'schedule.daily',
                'conditions' => $emptyConditions,
                'action' => 'create-inbox-item',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_rule_templates');
    }
};
