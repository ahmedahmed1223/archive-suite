<?php

declare(strict_types=1);

namespace App\Services\Storage;

final class StorageAuditPayload
{
    /** @param array<string, mixed> $payload @return array<string, mixed> */
    public static function redact(array $payload): array
    {
        $redacted = [];
        foreach ($payload as $key => $value) {
            $redacted[$key] = preg_match('/token|secret|password|authorization|credential/i', $key) === 1
                ? '[REDACTED]'
                : (is_array($value) ? self::redact($value) : $value);
        }

        return $redacted;
    }
}
