<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_jobs', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('record_id')->index();
            $table->string('operation')->index();
            $table->string('status')->default('queued')->index();
            $table->text('source_path')->nullable();
            $table->json('options')->nullable();
            $table->json('result')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('queued_at')->nullable()->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_jobs');
    }
};
