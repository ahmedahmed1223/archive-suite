<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('upload_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            // users.id is a bigint auto-increment (see 0001_01_01_000000_create_users_table.php) — foreignId, not foreignUuid.
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('disk');
            $table->string('folder')->nullable();
            $table->string('file_name');
            $table->unsignedBigInteger('total_size');
            $table->unsignedBigInteger('chunk_size');
            $table->unsignedInteger('total_chunks');
            // Indices already received, e.g. [0,1,3] — a JSON array rather than
            // a companion table because chunk counts stay small (<a few
            // thousand even for multi-GB files at multi-MB chunk sizes) and
            // every read/write goes through one locked row anyway (V1-711).
            $table->json('received_chunks')->default('[]');
            $table->string('checksum_sha256', 64)->nullable();
            $table->string('status')->default('pending'); // pending|completed|aborted
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index('status');
            $table->index('expires_at');
        });
    }

    public function down(): void { Schema::dropIfExists('upload_sessions'); }
};
