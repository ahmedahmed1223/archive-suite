<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('department_quality_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('department_id')->index();
            $table->string('type_id')->nullable()->index();
            $table->json('required_fields');
            $table->boolean('enabled')->default(true)->index();
            $table->timestamps();
            $table->unique(['department_id', 'type_id']);
        });
    }

    public function down(): void { Schema::dropIfExists('department_quality_rules'); }
};
