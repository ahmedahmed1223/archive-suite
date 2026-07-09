<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('montage_projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedTinyInteger('fps')->default(25);
            $table->json('tracks')->default('[]');
            $table->json('clips')->default('[]');
            $table->json('markers')->default('[]');
            $table->json('comments')->default('[]');
            $table->json('transitions')->default('[]');
            $table->string('status')->default('draft')->index();
            $table->timestamps();

            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('montage_projects');
    }
};
