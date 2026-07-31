<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metadata_templates', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('type_id')->nullable()->index();
            $table->string('name', 200);
            $table->json('fields');
            $table->json('tags')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metadata_templates');
    }
};
