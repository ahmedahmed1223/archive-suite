<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ScheduledUpload extends Model
{
    use HasFactory;
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    public const STATUSES = ['scheduled', 'claimed', 'processing', 'completed', 'cancelled', 'failed'];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'created_by',
        'idempotency_key',
        'record_id',
        'record_payload',
        'disk',
        'file_name',
        'staged_path',
        'total_size',
        'checksum_sha256',
        'time_zone',
        'status',
        'scheduled_at',
        'lease_expires_at',
        'attempts',
        'failure_code',
        'failure_message',
        'version',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'record_payload' => 'array',
            'scheduled_at' => 'datetime',
            'lease_expires_at' => 'datetime',
        ];
    }
}
