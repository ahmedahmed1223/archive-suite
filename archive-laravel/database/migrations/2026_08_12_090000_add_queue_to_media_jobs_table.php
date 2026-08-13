<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_jobs', function (Blueprint $table): void {
            $table->string('queue')->nullable()->index()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('media_jobs', function (Blueprint $table): void {
            $table->dropColumn('queue');
        });
    }
};
