<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('dropbox_connections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('status')->default('disconnected');
            $table->text('encrypted_access_token')->nullable();
            $table->text('encrypted_refresh_token')->nullable();
            $table->string('folder_path')->default('/');
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamps();
        });
        Schema::create('dropbox_sync_cursors', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('connection_id')->unique()->constrained('dropbox_connections')->cascadeOnDelete();
            $table->text('cursor')->nullable();
            $table->timestamps();
        });
        Schema::create('dropbox_webhook_deliveries', function (Blueprint $table): void {
            $table->id();
            $table->string('event_id')->unique();
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
        });
        Schema::create('dropbox_dead_letters', function (Blueprint $table): void {
            $table->id();
            $table->string('event_id')->index();
            $table->json('payload');
            $table->text('last_error');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('retry_after')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('dropbox_dead_letters');
        Schema::dropIfExists('dropbox_webhook_deliveries');
        Schema::dropIfExists('dropbox_sync_cursors');
        Schema::dropIfExists('dropbox_connections');
    }
};
