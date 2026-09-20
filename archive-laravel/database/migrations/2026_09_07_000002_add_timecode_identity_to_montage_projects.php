<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('montage_projects', function (Blueprint $table): void {
            $table->unsignedInteger('frame_rate_numerator')->default(25);
            $table->unsignedInteger('frame_rate_denominator')->default(1);
            $table->string('timecode_mode')->default('non_drop');
            $table->string('start_timecode')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('montage_projects', function (Blueprint $table): void {
            $table->dropColumn(['frame_rate_numerator', 'frame_rate_denominator', 'timecode_mode', 'start_timecode']);
        });
    }
};
