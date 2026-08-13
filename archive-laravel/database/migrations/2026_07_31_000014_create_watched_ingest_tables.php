<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('watched_ingest_batches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status')->default('pending');
            $table->string('disk');
            $table->string('directory');
            $table->timestamps();
        });
        Schema::create('watched_ingest_entries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('batch_id')->index();
            $table->string('source_path');
            $table->string('file_name');
            $table->unsignedBigInteger('size')->default(0);
            $table->string('checksum', 64)->nullable();
            $table->string('status');
            $table->string('reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watched_ingest_entries');
        Schema::dropIfExists('watched_ingest_batches');
    }
};
