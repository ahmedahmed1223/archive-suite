<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3-MEDIA-003: cached media duration used to reject out-of-range timeline
 * comments. Nothing in the ingest pipeline probes/persists duration today,
 * so this is filled lazily -- see MediaReviewCommentService::resolveKnownDuration()
 * for the "first request that reports a real duration wins, forever" policy.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('record_attachments', function (Blueprint $table): void {
            $table->decimal('duration_seconds', 10, 3)->nullable()->after('size_bytes');
        });
    }

    public function down(): void
    {
        Schema::table('record_attachments', function (Blueprint $table): void {
            $table->dropColumn('duration_seconds');
        });
    }
};
