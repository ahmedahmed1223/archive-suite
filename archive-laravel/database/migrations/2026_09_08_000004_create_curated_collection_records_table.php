<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('curated_collection_records', function (Blueprint $table): void {
            $table->uuid('curated_collection_id');
            $table->string('record_id');
            $table->unsignedInteger('position')->default(0);
            $table->timestamp('added_at')->useCurrent();
            $table->primary(['curated_collection_id', 'record_id']);
            $table->foreign('curated_collection_id')->references('id')->on('curated_collections')->cascadeOnDelete();
            $table->index(['curated_collection_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('curated_collection_records');
    }
};
