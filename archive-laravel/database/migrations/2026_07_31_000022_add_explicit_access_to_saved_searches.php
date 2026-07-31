<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('saved_searches', function (Blueprint $table): void {
            $table->string('department_id')->nullable()->index();
        });

        Schema::create('saved_search_access', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('saved_search_id')->index();
            $table->string('user_id')->index();
            $table->string('role');
            $table->timestamps();
            $table->unique(['saved_search_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_search_access');
        Schema::table('saved_searches', fn (Blueprint $table) => $table->dropColumn('department_id'));
    }
};
