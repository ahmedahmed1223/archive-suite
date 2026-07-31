<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_triage_flags', function (Blueprint $table): void {
            $table->string('record_id')->primary();
            $table->text('reason');
            $table->string('flagged_by')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_triage_flags');
    }
};
