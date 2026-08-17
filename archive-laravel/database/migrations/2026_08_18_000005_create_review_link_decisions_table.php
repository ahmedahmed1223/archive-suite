<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3-MEDIA-007: one immutable row per external-reviewer decision on a
 * review_links token. A reviewer has no User account (they only hold the
 * link's token), so identity here is free-text reviewer_name/reviewer_email
 * rather than a users FK -- this is the individual "vote" log that
 * ExternalReviewService rolls up to decide whether required_approvals has
 * been met and to drive the backing review_sessions transition. Rows are
 * never updated or deleted; the review report reads this table plus the
 * hash-chained audit_logs rows written alongside each insert as its proof.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_link_decisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('review_link_token');
            $table->string('reviewer_name');
            $table->string('reviewer_email')->nullable();
            $table->string('decision'); // approve | request_changes
            $table->text('notes')->nullable();
            $table->string('ip_address')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['review_link_token', 'created_at']);
            $table->index('decision');
            $table->foreign('review_link_token')->references('token')->on('review_links')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_link_decisions');
    }
};
