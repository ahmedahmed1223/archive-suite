<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_jobs', function (Blueprint $table): void {
            $table->string('created_by')->nullable()->after('record_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('media_jobs', function (Blueprint $table): void {
            $table->dropColumn('created_by');
        });
    }
};
