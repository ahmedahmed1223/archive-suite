<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_derivatives', function (Blueprint $table): void {
            // Only ProcessMediaWorkflow writes this after a worker returns a
            // successful render artifact declaring watermarkBurned=true. It
            // prevents a normal proxy from being repurposed as public review
            // media merely by setting review-link UI policy to "visible".
            $table->boolean('has_burned_in_watermark')->default(false)->after('storage_key');
        });
    }

    public function down(): void
    {
        Schema::table('media_derivatives', function (Blueprint $table): void {
            $table->dropColumn('has_burned_in_watermark');
        });
    }
};
