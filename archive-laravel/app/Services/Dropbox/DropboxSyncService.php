<?php

declare(strict_types=1);

namespace App\Services\Dropbox;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class DropboxSyncService
{
    public function __construct(private DropboxConnectionService $connections, private DropboxGateway $gateway) {}
    public function import(User $user): array
    {
        $connection = $this->connections->connection($user);
        if (! $connection || $connection->status !== 'connected') throw new \LogicException('Dropbox is not connected.');
        $cursor = DB::table('dropbox_sync_cursors')->where('connection_id', $connection->id)->value('cursor');
        $result = $this->gateway->listFolder($this->connections->accessToken($connection), $connection->folder_path, $cursor);
        DB::table('dropbox_sync_cursors')->updateOrInsert(['connection_id' => $connection->id], ['cursor' => $result['cursor'] ?? $cursor, 'updated_at' => now(), 'created_at' => now()]);
        $entries = array_values(array_filter($result['entries'] ?? [], fn (array $entry): bool => ($entry['.tag'] ?? '') === 'file'));
        return ['entries' => array_map(fn (array $entry): array => ['path' => $entry['path_display'] ?? $entry['path_lower'] ?? '', 'id' => $entry['id'] ?? null, 'size' => $entry['size'] ?? null], $entries), 'cursor' => $result['cursor'] ?? $cursor, 'hasMore' => (bool) ($result['has_more'] ?? false)];
    }
}
