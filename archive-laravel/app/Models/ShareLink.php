<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['token', 'scope', 'permission', 'expires_at', 'password_hash'])]
#[Hidden(['password_hash'])]
class ShareLink extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'token';

    protected $keyType = 'string';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'scope' => 'array',
            'expires_at' => 'datetime',
        ];
    }
}
