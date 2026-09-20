<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuthorityEntity extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = ['id', 'kind', 'preferred_label', 'aliases', 'merged_into_id', 'created_by'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['aliases' => 'array'];
    }
}
