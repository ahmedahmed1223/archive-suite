<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_relations', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('source_record_id')->index();
            $table->string('target_record_id')->index();
            $table->string('type')->default('related_to')->index();
            $table->text('note')->nullable();
            $table->json('metadata')->nullable();
            $table->string('created_by')->nullable()->index();
            $table->timestamps();

            $table->unique(['source_record_id', 'target_record_id', 'type'], 'record_relations_unique_link');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_relations');
    }
};
