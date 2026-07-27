<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('storage_operations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('idempotency_key')->unique();
            $table->string('action');
            $table->string('status')->index();
            $table->unsignedBigInteger('requested_by')->nullable()->index();
            $table->string('source_provider_id');
            $table->string('destination_provider_id')->nullable();
            $table->string('preview_token_hash', 64);
            $table->timestamp('preview_expires_at');
            $table->json('resume_state')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_operations');
    }
};
