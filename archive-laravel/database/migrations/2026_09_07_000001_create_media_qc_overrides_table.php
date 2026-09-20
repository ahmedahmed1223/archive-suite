<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_qc_overrides', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('media_inspection_id')->unique();
            $table->string('record_store');
            $table->string('record_uid');
            $table->string('version_token');
            $table->text('reason');
            $table->foreignId('overridden_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('overridden_at');
            $table->timestamps();
            $table->index(['record_store', 'record_uid', 'version_token']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_qc_overrides');
    }
};
