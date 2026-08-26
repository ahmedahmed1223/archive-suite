<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MontageProject extends Model
{
    use HasFactory;

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
        'revision',
        'active_revision_id',
        'owner_id',
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

    public function revisions(): HasMany
    {
        return $this->hasMany(MontageProjectRevision::class, 'montage_project_id');
    }

    public function activeRevision(): ?MontageProjectRevision
    {
        return $this->revisions()->orderByDesc('revision_number')->first();
    }

    public function exports(): HasMany
    {
        return $this->hasMany(MontageExport::class, 'montage_project_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }
}
