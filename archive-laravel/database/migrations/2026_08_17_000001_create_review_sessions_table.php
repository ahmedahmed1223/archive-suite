<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_store');
            $table->string('record_uid');
            // Nullable: null means the session reviews the record's primary
            // source file rather than a specific record_attachments row.
            $table->uuid('attachment_id')->nullable();
            // Snapshot of the reviewed media's identity (checksum-derived),
            // captured once at creation and never rewritten. This is what
            // keeps an approval pinned to the version it was granted on --
            // replacing the source/attachment changes the live checksum but
            // never this stored token, so old sessions read as stale instead
            // of silently covering the new content.
            $table->string('version_token');
            $table->string('state')->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['record_store', 'record_uid']);
            $table->index('attachment_id');
            $table->index('state');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_sessions');
    }
};
