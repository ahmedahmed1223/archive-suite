<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['store', 'uid', 'data', 'sync_version', 'last_modified_by'])]
class StorageRow extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'uid';

    protected $keyType = 'string';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'array',
            'last_modified_by' => 'array',
        ];
    }
}
