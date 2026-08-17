<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transcript_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_store');
            $table->string('record_uid');
            $table->string('format');
            // Canonical cue list for this snapshot: [{startSeconds, endSeconds, text}, ...].
            // The SRT/VTT text served for download is always derived from this,
            // never stored separately, so export can never drift from the cues.
            $table->json('cues');
            // Explicit certification flag. Once true, saving a new edit over
            // this transcript requires the caller to pass unlock=true --
            // see TranscriptVersionService::saveVersion(). This is what
            // keeps an approved transcript from being silently overwritten.
            $table->boolean('locked')->default(false);
            $table->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('locked_at')->nullable();
            // Set when this version was produced by a restore action, so the
            // history can show provenance without a separate audit lookup.
            $table->uuid('restored_from_version_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['record_store', 'record_uid', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transcript_versions');
    }
};
