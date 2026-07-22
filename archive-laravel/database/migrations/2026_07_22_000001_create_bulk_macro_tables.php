<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bulk_macros', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 200);
            $table->unsignedInteger('version')->default(1);
            $table->json('steps');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });

        Schema::create('bulk_macro_runs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('macro_id');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('macro_version');
            $table->json('targets');
            $table->json('results');
            $table->unsignedInteger('target_count')->default(0);
            $table->unsignedInteger('completed_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamps();

            $table->foreign('macro_id')->references('id')->on('bulk_macros')->cascadeOnDelete();
            $table->index(['macro_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bulk_macro_runs');
        Schema::dropIfExists('bulk_macros');
    }
};
