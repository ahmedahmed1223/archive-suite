<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('archival_nodes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('parent_id')->nullable();
            $table->string('level', 32);
            $table->string('title');
            $table->string('reference_code', 200)->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->string('record_store')->nullable();
            $table->string('record_uid')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['parent_id', 'position']);
            $table->index(['record_store', 'record_uid']);
        });

        // Add foreign key after table creation so the primary key constraint exists
        Schema::table('archival_nodes', function (Blueprint $table): void {
            $table->foreign('parent_id')->references('id')->on('archival_nodes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('archival_nodes');
    }
};
