<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One immutable vote from an authenticated approver. The (approval_request_id,
 * approver_id) unique constraint on the table -- not application logic --
 * is what makes double-voting impossible even under a race.
 */
class ApprovalDecision extends Model
{
    use HasUuids;

    public const DECISION_APPROVE = 'approve';

    public const DECISION_REJECT = 'reject';

    public const UPDATED_AT = null;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'approval_request_id', 'approver_id', 'decision', 'notes'];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }
}
