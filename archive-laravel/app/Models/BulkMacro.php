<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BulkMacro extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id', 'name', 'steps', 'version'];

    protected function casts(): array
    {
        return ['steps' => 'array', 'version' => 'integer'];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function runs(): HasMany
    {
        return $this->hasMany(BulkMacroRun::class, 'macro_id');
    }
}
