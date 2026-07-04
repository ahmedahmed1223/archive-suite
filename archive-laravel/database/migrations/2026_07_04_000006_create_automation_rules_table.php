<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_rules', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('user_id')->index();
            $table->string('name');
            $table->string('trigger')->index();
            $table->json('conditions')->default('{}');
            $table->string('action')->index();
            $table->boolean('enabled')->default(true)->index();
            $table->timestamp('last_run_at')->nullable();
            $table->timestamps();
        });

        Schema::create('automation_rule_runs', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('rule_id')->index();
            $table->string('user_id')->nullable()->index();
            $table->string('status')->index();
            $table->boolean('dry_run')->default(true);
            $table->unsignedInteger('matched_count')->default(0);
            $table->unsignedInteger('executed_count')->default(0);
            $table->text('message')->nullable();
            $table->json('sample_records')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_rule_runs');
        Schema::dropIfExists('automation_rules');
    }
};
