<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3-MEDIA-007: turns the plain view/comment review_links row into a
 * time-bounded external review link that can pin a version, prefer a
 * lightweight derivative over the original source, and back a
 * review_sessions decision (approve / request-changes / dual-approval).
 * All new columns are nullable so existing (pre-V3-MEDIA-007) rows and the
 * pre-existing opaque media_uid-only create flow keep working unchanged --
 * see ReviewLinksController::store() for the soft-degrade when the media_uid
 * does not resolve to a real storage_rows record.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('review_links', function (Blueprint $table): void {
            $table->string('record_store')->nullable()->after('media_uid');
            $table->uuid('attachment_id')->nullable()->after('record_store');
            // Same checksum-derived identity as review_sessions.version_token /
            // media_derivatives.version_token (ReviewSessionService::
            // resolveVersionToken) -- this is what lets the report endpoint
            // prove which version was actually reviewed.
            $table->string('version_token')->nullable()->after('attachment_id');
            // Relative path (validated via MediaPathGuard::isSafeRelative),
            // resolved server-side only -- never returned to a public caller.
            // Fallback source when no derivative is attached or ready.
            $table->string('source_path')->nullable()->after('version_token');
            $table->uuid('derivative_id')->nullable()->after('source_path');
            $table->uuid('review_session_id')->nullable()->after('derivative_id');
            $table->boolean('allow_download')->default(false)->after('review_session_id');
            // none | visible -- see ExternalReviewService docblock.
            $table->string('watermark_policy')->default('none')->after('allow_download');
            // 1 = single approval finalizes; 2 = dual approval (two distinct
            // reviewer names must both record 'approve').
            $table->unsignedTinyInteger('required_approvals')->default(1)->after('watermark_policy');

            $table->foreign('derivative_id')->references('id')->on('media_derivatives')->nullOnDelete();
            $table->foreign('review_session_id')->references('id')->on('review_sessions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('review_links', function (Blueprint $table): void {
            $table->dropForeign(['derivative_id']);
            $table->dropForeign(['review_session_id']);
            $table->dropColumn([
                'record_store',
                'attachment_id',
                'version_token',
                'source_path',
                'derivative_id',
                'review_session_id',
                'allow_download',
                'watermark_policy',
                'required_approvals',
            ]);
        });
    }
};
