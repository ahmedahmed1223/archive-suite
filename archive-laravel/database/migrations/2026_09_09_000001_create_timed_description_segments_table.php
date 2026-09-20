<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timed_description_segments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_id');
            $table->unsignedInteger('start_frame');
            $table->unsignedInteger('end_frame');
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->json('subjects')->nullable();
            $table->string('place', 500)->nullable();
            $table->text('rights_note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['record_id', 'start_frame']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timed_description_segments');
    }
};
