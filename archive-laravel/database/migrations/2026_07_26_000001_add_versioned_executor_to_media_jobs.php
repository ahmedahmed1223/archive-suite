<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_jobs', function (Blueprint $table): void {
            // Defaults make the migration compatible with already queued and
            // retained jobs; no existing result shape is rewritten.
            $table->string('executor')->default('local-v1')->index();
            $table->unsignedSmallInteger('contract_version')->default(1);
        });
    }

    public function down(): void
    {
        Schema::table('media_jobs', function (Blueprint $table): void {
            $table->dropIndex(['executor']);
            $table->dropColumn(['executor', 'contract_version']);
        });
    }
};
