<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collection_records', function (Blueprint $table): void {
            $table->string('collection_id')->index();
            $table->string('record_id');
            $table->timestamp('added_at');

            $table->primary(['collection_id', 'record_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_records');
    }
};
