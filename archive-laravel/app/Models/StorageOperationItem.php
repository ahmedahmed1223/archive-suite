<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class StorageOperationItem extends Model
{
    protected $fillable = [
        'storage_operation_id', 'source_path', 'destination_path', 'status', 'checksum', 'expected_checksum', 'error_code', 'error_message', 'resume_offset', 'metadata',
    ];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function operation(): BelongsTo
    {
        return $this->belongsTo(StorageOperation::class, 'storage_operation_id');
    }
}
