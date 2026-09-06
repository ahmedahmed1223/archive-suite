<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_inspections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_store');
            $table->string('record_uid');
            $table->string('inspection_type');
            $table->string('status')->default('completed');
            $table->string('version_token');
            $table->json('report');
            $table->string('media_job_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['record_store', 'record_uid']);
            $table->index('media_job_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_inspections');
    }
};
