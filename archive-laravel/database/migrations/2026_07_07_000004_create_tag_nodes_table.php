<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tag_nodes', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('user_id')->index();
            $table->string('tag');
            $table->string('parent');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tag_nodes');
    }
};
