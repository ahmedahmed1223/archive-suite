<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_segments', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('record_id')->index();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->json('tags')->nullable();
            $table->decimal('start_seconds', 10, 3)->nullable();
            $table->decimal('end_seconds', 10, 3)->nullable();
            $table->timestamps();

            $table->index(['record_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_segments');
    }
};
