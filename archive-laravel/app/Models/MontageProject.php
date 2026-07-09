<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MontageProject extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'name',
        'description',
        'fps',
        'tracks',
        'clips',
        'markers',
        'comments',
        'transitions',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tracks' => 'array',
            'clips' => 'array',
            'markers' => 'array',
            'comments' => 'array',
            'transitions' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }
}
