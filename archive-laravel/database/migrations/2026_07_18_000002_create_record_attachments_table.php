<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('record_attachments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_store');
            $table->string('record_uid');
            $table->string('disk');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes');
            $table->string('checksum_sha256', 64);
            $table->boolean('is_primary')->default(false);
            $table->string('processing_status')->default('ready');
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['record_store', 'record_uid']);
            $table->index('checksum_sha256');
            $table->index('processing_status');
            $table->unique(['disk', 'path']);
        });
    }

    public function down(): void { Schema::dropIfExists('record_attachments'); }
};
