<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V3-WORK-002: admin-configurable thresholds for the task escalation sweep
 * (see App\Console\Commands\CheckTaskEscalationsCommand). Single row keyed
 * by id='default' - a system-wide policy, not per-user (that distinction
 * belongs to notification preferences, not escalation timing).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_escalation_policies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->boolean('enabled')->default(true);
            // Minutes before target_deadline_at to send a non-mandatory
            // "due soon" notice. Null disables the due-soon notice entirely.
            $table->unsignedInteger('warning_before_minutes')->nullable();
            // Minutes between repeated MANDATORY overdue escalations while a
            // task stays overdue. Null escalates once and does not repeat.
            $table->unsignedInteger('repeat_minutes')->nullable();
            $table->timestamps();
        });

        DB::table('task_escalation_policies')->insert([
            'id' => 'default',
            'enabled' => true,
            'warning_before_minutes' => 60,
            'repeat_minutes' => 240,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('task_escalation_policies');
    }
};
