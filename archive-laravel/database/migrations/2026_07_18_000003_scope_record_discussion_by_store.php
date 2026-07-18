<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('record_notes', function (Blueprint $table): void {
            $table->string('record_store')->default('archive-items')->after('item_id');
            $table->index(['record_store', 'item_id', 'created_at']);
        });

        Schema::table('record_comments', function (Blueprint $table): void {
            $table->string('record_store')->default('archive-items')->after('item_id');
            $table->index(['record_store', 'item_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('record_notes', function (Blueprint $table): void {
            $table->dropIndex(['record_store', 'item_id', 'created_at']);
            $table->dropColumn('record_store');
        });

        Schema::table('record_comments', function (Blueprint $table): void {
            $table->dropIndex(['record_store', 'item_id', 'created_at']);
            $table->dropColumn('record_store');
        });
    }
};
