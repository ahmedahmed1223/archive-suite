<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_record_suggestions', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('record_id')->index();
            $table->text('summary')->nullable();
            $table->json('tags')->nullable();
            $table->string('type')->nullable();
            $table->string('subtype')->nullable();
            $table->string('status')->default('pending')->index();
            $table->string('created_by')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_record_suggestions');
    }
};
