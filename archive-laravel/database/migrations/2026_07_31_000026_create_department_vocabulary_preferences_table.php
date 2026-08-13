<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('department_vocabulary_preferences', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('user_id')->index();
            $table->string('department_id')->index();
            $table->string('term_id')->index();
            $table->timestamps();
            $table->unique(['user_id', 'department_id', 'term_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('department_vocabulary_preferences');
    }
};
