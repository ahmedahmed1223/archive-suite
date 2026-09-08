<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('curated_collections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('title', 500);
            $table->text('introduction')->nullable();
            $table->string('status', 32)->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void { Schema::dropIfExists('curated_collections'); }
};
