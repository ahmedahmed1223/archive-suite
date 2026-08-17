<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaClip extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'record_store',
        'record_uid',
        'attachment_id',
        'version_token',
        'title',
        'notes',
        'in_seconds',
        'out_seconds',
        'fps',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'in_seconds' => 'float',
            'out_seconds' => 'float',
            'fps' => 'integer',
        ];
    }
}
