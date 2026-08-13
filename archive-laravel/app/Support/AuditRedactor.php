<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\UploadedFile;

/**
 * The one sensitive-field rule every audit writer (AuditArchiveApiRequest,
 * MCP-804's create_review_request) shares — extracted so the redaction regex
 * has a single place to change, not one copy per audit writer that can drift.
 */
final class AuditRedactor
{
    /**
     * @param  array<string, mixed>  $value
     * @return array<string, mixed>
     */
    public static function redact(array $value): array
    {
        $redacted = [];

        foreach ($value as $key => $item) {
            if (self::isSensitiveKey((string) $key)) {
                $redacted[$key] = '[redacted]';

                continue;
            }

            if (is_array($item)) {
                $redacted[$key] = self::redact(array_slice($item, 0, 50, true));

                continue;
            }

            if ($item instanceof UploadedFile) {
                $redacted[$key] = [
                    'name' => $item->getClientOriginalName(),
                    'size' => $item->getSize(),
                    'mimeType' => $item->getClientMimeType(),
                ];

                continue;
            }

            if (is_object($item)) {
                $redacted[$key] = '[object '.class_basename($item).']';

                continue;
            }

            if (is_string($item) && strlen($item) > 500) {
                $redacted[$key] = substr($item, 0, 500).'...';

                continue;
            }

            $redacted[$key] = $item;
        }

        return $redacted;
    }

    public static function isSensitiveKey(string $key): bool
    {
        return preg_match('/password|token|secret|key|dsn|credential|authorization/', strtolower($key)) === 1;
    }
}
