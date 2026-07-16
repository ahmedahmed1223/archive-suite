<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * V1-756: one storage measurement. Rows are append-only history — nothing
 * updates a sample, because rewriting the past would rewrite the trend.
 */
class SystemMetricSample extends Model
{
    protected $fillable = [
        'captured_at',
        'disk_used_bytes',
        'disk_total_bytes',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
        'disk_used_bytes' => 'integer',
        'disk_total_bytes' => 'integer',
    ];
}
