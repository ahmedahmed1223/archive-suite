<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('naming_rules', function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->string('prefix', 100);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('naming_rules');
    }
};
