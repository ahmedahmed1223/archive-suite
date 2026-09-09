<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TimedDescriptionSegment extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = ['id', 'record_id', 'start_frame', 'end_frame', 'title', 'description', 'subjects', 'place', 'rights_note', 'created_by'];

    /** @return array<string, string> */
    protected function casts(): array { return ['subjects' => 'array']; }
}
