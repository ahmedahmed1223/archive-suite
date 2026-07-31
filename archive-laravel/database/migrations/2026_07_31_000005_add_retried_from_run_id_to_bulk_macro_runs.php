<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bulk_macro_runs', function (Blueprint $table): void {
            $table->uuid('retried_from_run_id')->nullable()->after('macro_version');
            $table->foreign('retried_from_run_id')->references('id')->on('bulk_macro_runs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('bulk_macro_runs', function (Blueprint $table): void {
            $table->dropForeign(['retried_from_run_id']);
            $table->dropColumn('retried_from_run_id');
        });
    }
};
