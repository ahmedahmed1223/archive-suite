<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('authority_entities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('kind', 32);
            $table->string('preferred_label', 500);
            $table->json('aliases')->default('[]');
            $table->uuid('merged_into_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('merged_into_id')->references('id')->on('authority_entities')->nullOnDelete();
            $table->index(['kind', 'preferred_label']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('authority_entities');
    }
};
