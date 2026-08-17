<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TranscriptVersion extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'record_store',
        'record_uid',
        'format',
        'cues',
        'locked',
        'locked_by',
        'locked_at',
        'restored_from_version_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'cues' => 'array',
            'locked' => 'boolean',
            'locked_at' => 'datetime',
        ];
    }
}
