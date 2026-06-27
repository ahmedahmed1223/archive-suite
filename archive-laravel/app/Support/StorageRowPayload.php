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

        return [
            'store' => $row->store,
            'uid' => $row->uid,
            'id' => $data['id'] ?? $row->uid,
            ...($data ?: []),
            'syncVersion' => $row->sync_version,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
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
