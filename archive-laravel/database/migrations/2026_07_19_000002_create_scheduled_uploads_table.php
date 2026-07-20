<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('scheduled_uploads', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            // users.id is a bigint auto-increment — foreignId, not foreignUuid.
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('idempotency_key', 255)->unique();
            $table->uuid('record_id')->nullable()->unique();
            $table->json('record_payload')->nullable();
            $table->string('disk');
            $table->string('file_name');
            $table->string('staged_path');
            $table->unsignedBigInteger('total_size');
            $table->string('checksum_sha256', 64)->nullable();
            $table->string('time_zone')->default('UTC');
            $table->string('status')->default('scheduled'); // scheduled|claimed|processing|completed|cancelled|failed
            $table->timestamp('scheduled_at');
            $table->timestamp('lease_expires_at')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->string('failure_code')->nullable();
            $table->text('failure_message')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->index(['status', 'scheduled_at']);
            $table->index(['status', 'lease_expires_at']);
            $table->index(['created_by', 'created_at']);
        });
    }

    public function down(): void { Schema::dropIfExists('scheduled_uploads'); }
};
