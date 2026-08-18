<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'settings', 'version'])]
class UserExperienceProfile extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['settings' => 'array', 'version' => 'integer'];
    }
}
