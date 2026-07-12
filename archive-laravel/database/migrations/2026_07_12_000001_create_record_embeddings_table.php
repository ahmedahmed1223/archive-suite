<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            // ponytail: sqlite (tests/CI) gets a vector-less shell table so any
            // by-name reference to record_embeddings doesn't blow up. pgvector
            // only exists on Postgres — real vector storage is created below.
            Schema::create('record_embeddings', function (Blueprint $table): void {
                $table->id();
                $table->string('store');
                $table->string('uid');
                $table->string('content_hash', 64);
                $table->timestamps();
                $table->unique(['store', 'uid']);
            });

            return;
        }

        DB::statement('CREATE EXTENSION IF NOT EXISTS vector');

        Schema::create('record_embeddings', function (Blueprint $table): void {
            $table->id();
            $table->string('store');
            $table->string('uid');
            $table->string('content_hash', 64);
            $table->timestamps();
            $table->unique(['store', 'uid']);
        });

        $dimensions = (int) config('embeddings.dimensions', 1536);
        DB::statement("ALTER TABLE record_embeddings ADD COLUMN embedding vector({$dimensions})");
        DB::statement('CREATE INDEX record_embeddings_embedding_hnsw ON record_embeddings USING hnsw (embedding vector_cosine_ops)');
    }

    public function down(): void
    {
        Schema::dropIfExists('record_embeddings');
    }
};
