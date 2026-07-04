<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_broadcast_metadata', function (Blueprint $table): void {
            $table->string('item_id')->primary();
            $table->string('mos_object_id')->nullable();
            $table->string('mos_program_id')->nullable();
            $table->string('mxf_umid')->nullable();
            $table->string('mxf_format')->nullable();
            $table->json('raw')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_broadcast_metadata');
    }
};
