<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApprovalRequest extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_EXECUTED = 'executed';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'operation_key', 'target_type', 'target_id', 'requested_by',
        'status', 'required_approvals', 'payload', 'executed_run_id', 'executed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'required_approvals' => 'integer',
            'executed_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function decisions(): HasMany
    {
        return $this->hasMany(ApprovalDecision::class);
    }
}
