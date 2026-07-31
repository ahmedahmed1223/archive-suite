<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_edit_claims', function (Blueprint $table): void {
            $table->string('record_id')->primary();
            $table->string('claimed_by')->nullable()->index();
            $table->string('claimed_by_name');
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_edit_claims');
    }
};
