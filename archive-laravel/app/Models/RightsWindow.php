<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RightsWindow extends Model
{
    use HasFactory;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'rights_record_id',
        'usage',
        'starts_at',
        'ends_at',
        'territories',
        'platforms',
        'granted',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'territories' => 'array',
            'platforms' => 'array',
            'granted' => 'boolean',
        ];
    }

    public function rightsRecord(): BelongsTo
    {
        return $this->belongsTo(RightsRecord::class);
    }
}
