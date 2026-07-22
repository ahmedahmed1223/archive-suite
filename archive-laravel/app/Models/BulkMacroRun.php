<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BulkMacroRun extends Model
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['id', 'macro_id', 'user_id', 'macro_version', 'targets', 'results', 'target_count', 'completed_count', 'failed_count'];

    protected function casts(): array
    {
        return ['targets' => 'array', 'results' => 'array', 'macro_version' => 'integer', 'target_count' => 'integer', 'completed_count' => 'integer', 'failed_count' => 'integer'];
    }

    public function macro(): BelongsTo
    {
        return $this->belongsTo(BulkMacro::class, 'macro_id');
    }
}
