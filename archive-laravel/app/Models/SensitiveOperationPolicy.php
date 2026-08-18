<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SensitiveOperationPolicy extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $primaryKey = 'operation_key';

    protected $fillable = ['operation_key', 'sensitive', 'required_approvals'];

    protected function casts(): array
    {
        return ['sensitive' => 'boolean', 'required_approvals' => 'integer'];
    }
}
