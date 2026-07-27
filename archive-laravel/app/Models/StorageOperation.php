<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class StorageOperation extends Model
{
    use HasUuids;

    protected $fillable = [
        'idempotency_key', 'action', 'status', 'requested_by', 'source_provider_id',
        'destination_provider_id', 'preview_token_hash', 'preview_expires_at', 'resume_state', 'metadata', 'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'preview_expires_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'resume_state' => 'array',
            'metadata' => 'array',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(StorageOperationItem::class);
    }
}
