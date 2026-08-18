<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3-WORK-002: SLA-like target duration on project_tasks.
 *
 * target_duration_minutes is the input (minutes from creation); target_deadline_at
 * is the absolute UTC deadline computed from it once, at write time - see
 * ProjectTasksController. Storing the resolved deadline (rather than
 * recomputing created_at + duration on every escalation sweep) keeps the
 * escalation check a plain UTC-timestamp comparison, matching how the rest
 * of the app stores time (config('app.timezone') is UTC; per-user timeZone
 * is a display-only setting - see DisplaySettingsService).
 *
 * due_soon_notified_at / escalated_at are the idempotency markers the
 * scheduled escalation command sets after sending each notification kind,
 * so re-running the sweep in the same window is a no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_tasks', function (Blueprint $table): void {
            $table->unsignedInteger('target_duration_minutes')->nullable()->after('due_date');
            $table->timestamp('target_deadline_at')->nullable()->index()->after('target_duration_minutes');
            $table->timestamp('due_soon_notified_at')->nullable()->after('target_deadline_at');
            $table->timestamp('escalated_at')->nullable()->after('due_soon_notified_at');
        });
    }

    public function down(): void
    {
        Schema::table('project_tasks', function (Blueprint $table): void {
            $table->dropColumn(['target_duration_minutes', 'target_deadline_at', 'due_soon_notified_at', 'escalated_at']);
        });
    }
};
