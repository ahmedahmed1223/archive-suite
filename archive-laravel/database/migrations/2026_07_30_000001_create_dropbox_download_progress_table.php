<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** V1-762: tracks resumable ingest downloads of large Dropbox files. The sync
 * cursor (dropbox_sync_cursors) already advances past a file's listing entry
 * once seen, so it cannot answer "did we finish downloading this file's
 * bytes" -- a crash mid-download needs its own progress record to resume
 * from the last byte written instead of restarting or silently skipping. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dropbox_download_progress', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('connection_id')->constrained('dropbox_connections')->cascadeOnDelete();
            $table->string('dropbox_path');
            $table->string('local_key');
            $table->unsignedBigInteger('total_size');
            $table->unsignedBigInteger('bytes_downloaded')->default(0);
            $table->string('status')->default('downloading');
            $table->timestamps();
            $table->unique(['connection_id', 'dropbox_path']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dropbox_download_progress');
    }
};
