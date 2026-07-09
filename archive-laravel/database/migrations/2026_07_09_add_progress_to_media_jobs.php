<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_jobs', function (Blueprint $table) {
            $table->string('progress_stage')->nullable()->after('error');
            $table->integer('progress_percent')->nullable()->after('progress_stage');
        });
    }

    public function down(): void
    {
        Schema::table('media_jobs', function (Blueprint $table) {
            $table->dropColumn(['progress_stage', 'progress_percent']);
        });
    }
};
