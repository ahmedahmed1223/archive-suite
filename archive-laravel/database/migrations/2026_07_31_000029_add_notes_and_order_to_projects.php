<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->text('notes')->nullable()->after('name');
            $table->unsignedInteger('sort_order')->default(0)->after('notes');
        });
        Schema::table('project_records', function (Blueprint $table): void {
            $table->unsignedInteger('position')->default(0)->after('record_id');
        });
    }

    public function down(): void
    {
        Schema::table('project_records', fn (Blueprint $table) => $table->dropColumn('position'));
        Schema::table('projects', fn (Blueprint $table) => $table->dropColumn(['notes', 'sort_order']));
    }
};
