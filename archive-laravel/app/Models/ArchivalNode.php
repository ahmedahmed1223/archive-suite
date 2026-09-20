<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArchivalNode extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = ['id', 'parent_id', 'level', 'title', 'reference_code', 'position', 'record_store', 'record_uid', 'created_by'];
}
