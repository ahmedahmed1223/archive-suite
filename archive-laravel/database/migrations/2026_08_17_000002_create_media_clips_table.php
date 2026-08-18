<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_clips', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_store');
            $table->string('record_uid');
            // Nullable: null means the clip is timed against the record's
            // primary source file rather than a specific record_attachments
            // row -- same convention as review_sessions.attachment_id.
            $table->uuid('attachment_id')->nullable();
            // Same checksum-derived identity concept as
            // review_sessions.version_token (see ReviewSessionService::
            // resolveVersionToken, which this table's writes reuse). Pinned
            // once at creation so a clip's in/out times stay unambiguous
            // even after the source is replaced -- the export always carries
            // this token alongside the timecodes.
            $table->string('version_token');
            $table->string('title');
            $table->text('notes')->nullable();
            // Seconds, not frames -- matches the browser <video>/<audio>
            // currentTime the studio and compare players already operate on.
            // Frame-accurate replay against the source is recovered at
            // export time by combining these with `fps`.
            $table->decimal('in_seconds', 12, 3);
            $table->decimal('out_seconds', 12, 3);
            $table->unsignedSmallInteger('fps')->default(25);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['record_store', 'record_uid']);
            $table->index('attachment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_clips');
    }
};
