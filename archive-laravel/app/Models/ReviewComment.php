<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewComment extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'media_uid',
        'timecode_seconds',
        'author',
        'body',
        'annotation',
        'resolved',
    ];

    protected function casts(): array
    {
        return [
            'timecode_seconds' => 'decimal:3',
            'annotation' => 'array',
            'resolved' => 'boolean',
        ];
    }
}
