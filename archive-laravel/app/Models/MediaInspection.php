<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaInspection extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = ['id', 'record_store', 'record_uid', 'inspection_type', 'status', 'version_token', 'report', 'media_job_id', 'created_by', 'completed_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['report' => 'array', 'completed_at' => 'datetime'];
    }
}
