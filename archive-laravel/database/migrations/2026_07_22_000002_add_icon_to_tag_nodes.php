<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tag_nodes', function (Blueprint $table): void {
            $table->string('icon')->nullable()->default(null)->after('color');
        });
    }

    public function down(): void
    {
        Schema::table('tag_nodes', function (Blueprint $table): void {
            $table->dropColumn('icon');
        });
    }
};
