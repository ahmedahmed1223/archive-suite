<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collaboration_presence', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('room_key')->index();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('display_name');
            $table->string('status')->default('active');
            $table->string('resource_id')->nullable()->index();
            $table->json('cursor')->nullable();
            $table->timestamp('last_seen_at')->index();
            $table->timestamps();

            $table->unique(['room_key', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collaboration_presence');
    }
};
