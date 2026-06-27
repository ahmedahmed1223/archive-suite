<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RightsRecord extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'item_id',
        'rights_holder',
        'license_type',
        'embargo_start',
        'embargo_end',
        'expires_at',
        'geo_restrictions',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'embargo_start' => 'datetime',
            'embargo_end' => 'datetime',
            'expires_at' => 'datetime',
            'geo_restrictions' => 'array',
        ];
    }
}
