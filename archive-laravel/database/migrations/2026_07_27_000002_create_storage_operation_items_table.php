<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_operation_items', function (Blueprint $table): void {
            $table->id();
            $table->uuid('storage_operation_id');
            $table->string('source_path')->nullable();
            $table->string('destination_path')->nullable();
            $table->string('status')->default('pending')->index();
            $table->string('checksum', 128)->nullable();
            $table->string('expected_checksum', 128)->nullable();
            $table->string('error_code')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedBigInteger('resume_offset')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->foreign('storage_operation_id')->references('id')->on('storage_operations')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storage_operation_items');
    }
};
