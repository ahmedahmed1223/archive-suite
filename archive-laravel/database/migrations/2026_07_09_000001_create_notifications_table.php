<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table): void {
            $table->id();
            $table->string('user_id')->index();
            $table->string('type')->index(); // 'ingest_complete', 'backup_result', 'share_event', etc.
            $table->string('title');
            $table->text('message');
            $table->json('metadata')->nullable(); // For storing related IDs, context
            $table->boolean('is_read')->default(false)->index();
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
