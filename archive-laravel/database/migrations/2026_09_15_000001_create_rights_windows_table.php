<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rights_windows', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('rights_record_id');
            $table->string('usage');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->json('territories')->default('[]');
            $table->json('platforms')->default('[]');
            $table->boolean('granted')->default(true);
            $table->timestamps();

            $table->foreign('rights_record_id')
                ->references('id')
                ->on('rights_records')
                ->onDelete('cascade');

            $table->index('rights_record_id');
            $table->index('usage');
            $table->index('ends_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rights_windows');
    }
};
