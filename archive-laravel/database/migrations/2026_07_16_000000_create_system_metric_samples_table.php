<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V1-756: the storage series the forecast fits. `SystemMetrics` only ever
 * exposed a point-in-time snapshot, so there was nothing to fit a trend to.
 *
 * One row per capture, appended hourly and pruned by retention. The index is
 * on captured_at because every read is a time window and every prune is a
 * cutoff — an unindexed column here would table-scan on both paths.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_metric_samples', function (Blueprint $table) {
            $table->id();
            $table->timestamp('captured_at')->index();
            $table->unsignedBigInteger('disk_used_bytes');
            $table->unsignedBigInteger('disk_total_bytes');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_metric_samples');
    }
};
