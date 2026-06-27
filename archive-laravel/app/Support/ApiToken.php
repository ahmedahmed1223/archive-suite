<?php

namespace App\Support;

use Illuminate\Support\Str;

class ApiToken
{
    public static function create(): string
    {
        return Str::random(80);
    }

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
