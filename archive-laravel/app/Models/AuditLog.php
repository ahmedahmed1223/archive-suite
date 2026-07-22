<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * V1-734: every row is chained to the previous one via `prev_hash`/`hash`
 * (sha256 of the row's fields + prev_hash), computed once here on create so
 * every write path (currently just AuditArchiveApiRequest) gets it for free.
 * Tampering with a row's content or deleting a row from the middle breaks
 * the chain — see AuditVerifyChainCommand.
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'action',
        'event',
        'resource_type',
        'resource_id',
        'actor_id',
        'outcome',
        'status_code',
        'metadata',
        'ip_address',
        'user_agent',
    ];

    protected static function booted(): void
    {
        static::creating(function (AuditLog $log): void {
            $log->prev_hash = static::query()->latest('id')->value('hash');
            // creating() fires before Eloquent's own updateTimestamps(), so
            // created_at is otherwise still null here; set it explicitly so
            // the hash is computed against the same value that gets persisted.
            $log->created_at ??= now();
            $log->hash = $log->computeHash();
        });
    }

    public function computeHash(): string
    {
        $payload = json_encode([
            'action' => $this->action,
            'event' => $this->event,
            'resource_type' => $this->resource_type,
            'resource_id' => $this->resource_id,
            'actor_id' => $this->actor_id,
            'outcome' => $this->outcome,
            'status_code' => $this->status_code,
            'metadata' => $this->metadata,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'prev_hash' => $this->prev_hash,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);

        return hash('sha256', $payload);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }
}
