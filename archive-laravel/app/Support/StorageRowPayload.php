<?php

namespace App\Support;

use stdClass;

class StorageRowPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function format(stdClass $row): array
    {
        $data = json_decode((string) $row->data, true);
        $payload = is_array($data) ? $data : [];

        return [
            'store' => $row->store,
            'uid' => $row->uid,
            'id' => $payload['id'] ?? $row->uid,
            ...$payload,
            'descriptorCompletion' => self::descriptorCompletion($payload),
            'syncVersion' => $row->sync_version,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{status: string, complete: int, total: int, missing: list<string>}
     */
    private static function descriptorCompletion(array $payload): array
    {
        $missing = [];

        foreach (['title', 'description', 'type'] as $field) {
            if (! is_string($payload[$field] ?? null) || trim($payload[$field]) === '') {
                $missing[] = $field;
            }
        }

        $hasTag = is_array($payload['tags'] ?? null)
            && count(array_filter(
                $payload['tags'],
                static fn (mixed $tag): bool => is_string($tag) && trim($tag) !== ''
            )) > 0;

        if (! $hasTag) {
            $missing[] = 'tags';
        }

        $complete = 4 - count($missing);

        return [
            'status' => $complete === 4 ? 'green' : ($complete >= 2 ? 'yellow' : 'red'),
            'complete' => $complete,
            'total' => 4,
            'missing' => $missing,
        ];
    }

    public static function encodeCursor(string $uid): string
    {
        return rtrim(strtr(base64_encode($uid), '+/', '-_'), '=');
    }

    public static function decodeCursor(string $cursor): string
    {
        $normalized = strtr($cursor, '-_', '+/');
        $padding = (4 - strlen($normalized) % 4) % 4;
        $decoded = base64_decode($normalized.str_repeat('=', $padding), true);

        return is_string($decoded) ? $decoded : '';
    }
}
