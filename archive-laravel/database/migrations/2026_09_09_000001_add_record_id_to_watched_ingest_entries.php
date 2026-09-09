<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('watched_ingest_entries', function (Blueprint $table): void {
            $table->uuid('record_id')->nullable()->index()->after('checksum');
        });
    }

    public function down(): void
    {
        Schema::table('watched_ingest_entries', function (Blueprint $table): void {
            $table->dropIndex(['record_id']);
            $table->dropColumn('record_id');
        });
    }
};
