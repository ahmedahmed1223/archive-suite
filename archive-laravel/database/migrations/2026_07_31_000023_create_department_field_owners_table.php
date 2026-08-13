<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('department_field_owners', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('department_id')->index();
            $table->string('field');
            $table->string('owner');
            $table->timestamps();
            $table->unique(['department_id', 'field']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('department_field_owners');
    }
};
