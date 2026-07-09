<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaJob extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'record_id',
        'operation',
        'status',
        'source_path',
        'options',
        'result',
        'error',
        'progress_stage',
        'progress_percent',
        'queued_at',
        'started_at',
        'completed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'options' => 'array',
            'result' => 'array',
            'queued_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
