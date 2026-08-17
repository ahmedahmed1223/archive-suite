<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Timeline marker/comment for the unified media studio (V3-MEDIA-003).
 * Not to be confused with ReviewComment (legacy §7 visual review, point-in-time
 * only, keyed by an opaque media_uid) -- see the create-table migration for
 * why this is a separate table rather than an extension of that one.
 */
class MediaReviewComment extends Model
{
    public const TYPE_ISSUE = 'issue';

    public const TYPE_SUGGESTION = 'suggestion';

    public const TYPE_HIGHLIGHT = 'highlight';

    public const TYPE_CHAPTER = 'chapter';

    public const TYPES = [self::TYPE_ISSUE, self::TYPE_SUGGESTION, self::TYPE_HIGHLIGHT, self::TYPE_CHAPTER];

    public const STATE_OPEN = 'open';

    public const STATE_RESOLVED = 'resolved';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'record_store',
        'record_uid',
        'attachment_id',
        'review_session_id',
        'type',
        'start_seconds',
        'end_seconds',
        'body',
        'state',
        'created_by',
        'resolved_by',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'start_seconds' => 'decimal:3',
            'end_seconds' => 'decimal:3',
            'resolved_at' => 'datetime',
        ];
    }
}
