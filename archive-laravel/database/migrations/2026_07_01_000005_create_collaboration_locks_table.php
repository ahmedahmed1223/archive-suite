<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collaboration_locks', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('room_key')->index();
            $table->string('resource_id')->index();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('display_name');
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->unique(['room_key', 'resource_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collaboration_locks');
    }
};
