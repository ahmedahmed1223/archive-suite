<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaQcOverride extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'media_inspection_id', 'record_store', 'record_uid', 'version_token', 'reason', 'overridden_by', 'overridden_at'];

    protected function casts(): array
    {
        return ['overridden_at' => 'datetime'];
    }
}
