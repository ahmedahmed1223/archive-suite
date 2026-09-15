<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaDerivative extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'record_store',
        'record_uid',
        'attachment_id',
        'derivative_type',
        'version_token',
        'settings',
        'settings_hash',
        'status',
        'storage_key',
        'has_burned_in_watermark',
        'media_job_id',
        'error',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'has_burned_in_watermark' => 'boolean',
        ];
    }
}
