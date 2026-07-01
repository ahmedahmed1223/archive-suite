<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['id', 'room_key', 'user_id', 'display_name', 'status', 'resource_id', 'cursor', 'last_seen_at'])]
class CollaborationPresence extends Model
{
    protected $table = 'collaboration_presence';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cursor' => 'array',
            'last_seen_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, CollaborationPresence>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
