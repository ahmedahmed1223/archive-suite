<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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

    public function revisions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(MontageProjectRevision::class, 'montage_project_id');
    }

    public function activeRevision(): ?MontageProjectRevision
    {
        return $this->revisions()->orderByDesc('revision_number')->first();
    }

    public function exports(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(MontageExport::class, 'montage_project_id');
    }
}
