<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use LogicException;

/**
 * An immutable, revisioned snapshot of a montage project timeline.
 * Revisions are write-once: any update attempt throws. Corrections are made
 * by creating the next revision number, never by editing history.
 */
class MontageProjectRevision extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new LogicException('Montage revisions are immutable.');
        });
    }

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'montage_project_id',
        'revision_number',
        'created_by',
        'tracks',
        'clips',
        'effects',
        'markers',
        'comments',
        'transitions',
        'source_version_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tracks' => 'array',
            'clips' => 'array',
            'effects' => 'array',
            'markers' => 'array',
            'comments' => 'array',
            'transitions' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function project(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(MontageProject::class, 'montage_project_id');
    }

    public function author(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
