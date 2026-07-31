<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_field_sources', function (Blueprint $table): void {
            $table->string('record_id');
            $table->string('field');
            $table->string('source');
            $table->timestamp('updated_at');

            $table->primary(['record_id', 'field']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_field_sources');
    }
};
