<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('watched_ingest_entries', function (Blueprint $table): void {
            $table->json('routing')->nullable();
        });
        Schema::create('watched_ingest_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('match_type');
            $table->string('pattern');
            $table->string('metadata_template_id')->nullable();
            $table->json('tags')->nullable();
            $table->string('staging_directory');
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('watched_ingest_rules');
        Schema::table('watched_ingest_entries', function (Blueprint $table): void {
            $table->dropColumn('routing');
        });
    }
};
