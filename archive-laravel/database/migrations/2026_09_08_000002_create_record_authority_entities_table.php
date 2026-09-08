<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_authority_entities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_id');
            $table->uuid('authority_entity_id');
            $table->string('relationship', 64);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('authority_entity_id')->references('id')->on('authority_entities')->cascadeOnDelete();
            $table->unique(['record_id', 'authority_entity_id']);
        });
    }

    public function down(): void { Schema::dropIfExists('record_authority_entities'); }
};
