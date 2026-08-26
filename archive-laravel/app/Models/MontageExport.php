<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MontageExport extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected static function booted(): void
    {
        static::creating(function (self $export): void {
            if ($export->id === null) {
                $export->id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'montage_project_id',
        'montage_project_revision_id',
        'requested_by',
        'preset',
        'status',
        'progress',
        'settings',
        'checksum',
        'error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function project(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(MontageProject::class, 'montage_project_id');
    }

    public function revision(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(MontageProjectRevision::class, 'montage_project_revision_id');
    }

    public function requester(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
