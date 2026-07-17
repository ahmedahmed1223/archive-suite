<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V1-759: admin-managed API keys for external automation. Only the SHA-256
 * hash of the token is ever stored — the raw token is shown once in the
 * create response and never persisted. `role` is validated at the
 * controller layer to editor|viewer only (never admin), and `user_id` ties
 * the key to a real user row so downstream created_by/actor FKs stay valid
 * when a request authenticates via API key instead of a session.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_keys', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('role');
            $table->string('token_hash')->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_keys');
    }
};
