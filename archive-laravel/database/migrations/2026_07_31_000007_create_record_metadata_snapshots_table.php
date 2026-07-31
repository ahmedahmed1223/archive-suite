<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_metadata_snapshots', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('store')->index();
            $table->string('record_id')->index();
            $table->json('snapshot');
            $table->string('changed_by')->nullable()->index();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['store', 'record_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_metadata_snapshots');
    }
};
