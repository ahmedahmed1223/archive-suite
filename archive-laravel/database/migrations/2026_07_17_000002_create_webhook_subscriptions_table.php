<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V1-759: webhook subscriptions for external automation. `secret_hash`
 * stores SHA-256(rawSecret) — the raw secret is shown once in the create
 * response, never persisted. Outbound deliveries sign with
 * HMAC-SHA256(body, secret_hash): since the subscriber can independently
 * derive SHA256(rawSecret) themselves, this lets the server sign every
 * future delivery without ever retaining the raw secret.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_subscriptions', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name')->nullable();
            $table->string('url');
            $table->json('events');
            $table->string('secret_hash');
            $table->boolean('active')->default(true);
            $table->unsignedInteger('consecutive_failures')->default(0);
            $table->timestamp('last_delivered_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_subscriptions');
    }
};
