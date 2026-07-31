<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_favorites', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('user_id')->index();
            $table->string('store', 100)->default('archive-items');
            $table->string('record_id', 100);
            $table->timestamps();
            $table->unique(['user_id', 'store', 'record_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_favorites');
    }
};
