<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timed_description_segment_authority_entities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('timed_description_segment_id');
            $table->uuid('authority_entity_id');
            $table->string('relationship', 64);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->foreign('timed_description_segment_id', 'timed_segment_authority_segment_fk')->references('id')->on('timed_description_segments')->cascadeOnDelete();
            $table->foreign('authority_entity_id', 'timed_segment_authority_entity_fk')->references('id')->on('authority_entities')->cascadeOnDelete();
            $table->unique(['timed_description_segment_id', 'authority_entity_id'], 'timed_segment_authority_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timed_description_segment_authority_entities');
    }
};
