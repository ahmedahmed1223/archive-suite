<?php

declare(strict_types=1);

namespace App\Services\Storage;

use InvalidArgumentException;

final class StoragePath
{
    public static function normalize(string $path): string
    {
        $path = str_replace('\\', '/', trim($path));
        $parts = [];
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.') {
                continue;
            }
            if ($part === '..' || str_contains($part, "\0")) {
                throw new InvalidArgumentException('Storage path escapes its configured root.');
            }
            $parts[] = $part;
        }

        return implode('/', $parts);
    }
}
