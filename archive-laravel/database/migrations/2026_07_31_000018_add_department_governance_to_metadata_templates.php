<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('metadata_templates', function (Blueprint $table): void {
            $table->string('department_id')->nullable()->index();
            $table->boolean('enabled')->default(true)->index();
            $table->json('usage_roles')->nullable();
            $table->unsignedInteger('current_version')->default(1);
            $table->string('created_by_id')->nullable();
            $table->string('updated_by_id')->nullable();
        });

        Schema::create('metadata_template_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('template_id')->index();
            $table->unsignedInteger('version');
            $table->json('snapshot');
            $table->string('created_by_id')->nullable();
            $table->timestamp('created_at');
            $table->unique(['template_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metadata_template_versions');
        Schema::table('metadata_templates', function (Blueprint $table): void {
            $table->dropColumn(['department_id', 'enabled', 'usage_roles', 'current_version', 'created_by_id', 'updated_by_id']);
        });
    }
};
