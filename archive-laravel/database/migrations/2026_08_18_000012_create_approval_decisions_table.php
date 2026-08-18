<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3-WORK-003: one immutable vote per (approval_requests row, approver).
 * The unique constraint below is the hard backstop against double-voting;
 * the requester never gets a row here at all -- see
 * App\Support\SelfApprovalGuard and ApprovalRequestService::decide().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_decisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('approval_request_id');
            $table->foreignId('approver_id')->constrained('users')->cascadeOnDelete();
            $table->string('decision');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->foreign('approval_request_id')->references('id')->on('approval_requests')->cascadeOnDelete();
            $table->unique(['approval_request_id', 'approver_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_decisions');
    }
};
