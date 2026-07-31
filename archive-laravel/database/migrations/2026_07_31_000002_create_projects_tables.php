<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name', 200);
            $table->timestamps();
        });

        Schema::create('project_records', function (Blueprint $table): void {
            $table->string('project_id')->index();
            $table->string('record_id')->index();
            $table->timestamp('linked_at');
            $table->primary(['project_id', 'record_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_records');
        Schema::dropIfExists('projects');
    }
};
