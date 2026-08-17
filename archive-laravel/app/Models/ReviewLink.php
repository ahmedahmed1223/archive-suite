<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'token', 'media_uid', 'permission', 'expires_at',
    'record_store', 'attachment_id', 'version_token', 'source_path',
    'derivative_id', 'review_session_id', 'allow_download', 'watermark_policy',
    'required_approvals',
])]
class ReviewLink extends Model
{
    public const WATERMARK_NONE = 'none';

    public const WATERMARK_VISIBLE = 'visible';

    public $incrementing = false;

    protected $primaryKey = 'token';

    protected $keyType = 'string';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'allow_download' => 'boolean',
            'required_approvals' => 'integer',
        ];
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
