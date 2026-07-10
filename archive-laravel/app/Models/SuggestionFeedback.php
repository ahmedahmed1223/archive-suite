<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SuggestionFeedback extends Model
{
    protected $table = 'suggestion_feedback';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }
}
