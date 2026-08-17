<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewSession extends Model
{
    public const STATE_DRAFT = 'draft';

    public const STATE_IN_REVIEW = 'in_review';

    public const STATE_CHANGES_REQUESTED = 'changes_requested';

    public const STATE_APPROVED = 'approved';

    public const STATE_CLOSED = 'closed';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'record_store',
        'record_uid',
        'attachment_id',
        'version_token',
        'state',
        'created_by',
        'decided_by',
        'decided_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
        ];
    }
}
