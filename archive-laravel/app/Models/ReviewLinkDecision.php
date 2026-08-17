<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One immutable "vote" from an external reviewer on a review_links token.
 * See the create-table migration docblock for why identity here is
 * free-text rather than a users FK.
 */
class ReviewLinkDecision extends Model
{
    public const DECISION_APPROVE = 'approve';

    public const DECISION_REQUEST_CHANGES = 'request_changes';

    public const UPDATED_AT = null;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'review_link_token',
        'reviewer_name',
        'reviewer_email',
        'decision',
        'notes',
        'ip_address',
    ];
}
