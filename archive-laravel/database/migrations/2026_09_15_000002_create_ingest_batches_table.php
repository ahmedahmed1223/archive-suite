<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * V2-OPS-002: every ingested file has to belong to a batch. Watched ingest
     * and chunked uploads already had one; a directory scan created loose
     * records with nothing tying a run together, so "what did that scan bring
     * in, and what did it refuse" had no answer.
     */
    public function up(): void
    {
        Schema::create('ingest_batches', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('source');
            $table->string('disk');
            $table->string('directory');
            $table->unsignedInteger('ingested_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            // Why each file was refused, so a skip is not silently the same
            // thing as a failure.
            $table->json('outcomes')->default('[]');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('source');
            $table->index('completed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ingest_batches');
    }
};
