<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3-WORK-003: a dual-approval request for a sensitive operation. Today the
 * only target_type is 'bulk-macro' (target_id -> bulk_macros.id), gated by
 * sensitive_operation_policies. payload snapshots the exact targets and the
 * macro version approved against, so a macro edited after approval cannot
 * silently execute under a stale approval (see
 * ApprovalRequestService::execute()).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('operation_key');
            $table->string('target_type');
            $table->string('target_id');
            $table->foreignId('requested_by')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('pending');
            $table->unsignedTinyInteger('required_approvals')->default(2);
            $table->json('payload');
            $table->uuid('executed_run_id')->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->index(['target_type', 'target_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_requests');
    }
};
