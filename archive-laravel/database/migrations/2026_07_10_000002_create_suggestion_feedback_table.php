<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suggestion_feedback', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('user_id')->index();
            $table->string('suggestion_key');
            $table->string('context', 32);
            $table->string('value', 32);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'suggestion_key'], 'suggestion_feedback_user_key_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suggestion_feedback');
    }
};
