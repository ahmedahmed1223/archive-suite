<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3-MEDIA-003: timeline markers/comments for the unified media studio.
 * Deliberately a new table rather than reusing review_comments (§7, 2026-07-01)
 * -- that table is point-in-time only, untyped, and keyed by an opaque
 * media_uid with no attachment/session linkage, which does not fit the
 * studio's record+attachment+review-session model. See ReviewComment vs
 * MediaReviewComment docblocks for the split rationale.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_review_comments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_store');
            $table->string('record_uid');
            // Nullable: null means the comment targets the record's primary
            // source file rather than a specific record_attachments row.
            $table->uuid('attachment_id')->nullable();
            // Optional link to the review session this marker was raised
            // during (V3-MEDIA-002). Comments can exist without a session.
            $table->uuid('review_session_id')->nullable();
            $table->string('type');
            $table->decimal('start_seconds', 10, 3);
            // Null start_seconds..end_seconds means a point-in-time marker;
            // a non-null end_seconds makes it a time-range marker.
            $table->decimal('end_seconds', 10, 3)->nullable();
            $table->text('body');
            $table->string('state')->default('open');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['record_store', 'record_uid']);
            $table->index('attachment_id');
            $table->index('review_session_id');
            $table->index('state');

            $table->foreign('review_session_id')->references('id')->on('review_sessions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_review_comments');
    }
};
