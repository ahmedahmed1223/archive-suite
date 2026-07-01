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
        'resolved',
    ];

    protected function casts(): array
    {
        return [
            'timecode_seconds' => 'decimal:3',
            'resolved' => 'boolean',
        ];
    }
}
