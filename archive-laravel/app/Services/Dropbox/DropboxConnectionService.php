<?php

declare(strict_types=1);

namespace App\Services\Dropbox;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class DropboxConnectionService
{
    public function __construct(private DropboxGateway $gateway) {}

    public function configured(): bool
    {
        return filled(config('services.dropbox.client_id')) && filled(config('services.dropbox.client_secret'));
    }

    public function status(User $user): array
    {
        $connection = DB::table('dropbox_connections')->where('user_id', $user->id)->first();
        if (! $this->configured()) return ['status' => 'disabled', 'configured' => false, 'folderPath' => null];
        return ['status' => $connection?->status ?? 'disconnected', 'configured' => true, 'folderPath' => $connection?->folder_path];
    }

    public function connect(User $user, string $accessToken, ?string $refreshToken, string $folderPath, ?string $expiresAt = null): array
    {
        if (! $this->configured()) throw new \LogicException('Dropbox OAuth is not configured.');
        DB::table('dropbox_connections')->updateOrInsert(['user_id' => $user->id], [
            'status' => 'connected', 'encrypted_access_token' => Crypt::encryptString($accessToken),
            'encrypted_refresh_token' => $refreshToken ? Crypt::encryptString($refreshToken) : null,
            'folder_path' => $this->normalizeFolder($folderPath), 'token_expires_at' => $expiresAt,
            'updated_at' => now(), 'created_at' => now(),
        ]);
        return $this->status($user);
    }

    /** V1-762: lists the immediate subfolders at $path so the settings UI can offer a real
     *  folder picker instead of a free-text path. Files are excluded -- Dropbox's list_folder
     *  entries carry a ".tag" of "folder" or "file", and only folders are pickable targets. */
    public function browseFolders(User $user, string $path = '/'): array
    {
        $connection = $this->connection($user);
        if (! $connection || $connection->status !== 'connected') {
            throw new \LogicException('Dropbox is not connected.');
        }
        $token = $this->accessToken($connection);
        $normalizedPath = $path === '/' ? '' : $this->normalizeFolder($path);
        $result = $this->gateway->listFolder($token, $normalizedPath);
        $folders = array_values(array_filter($result['entries'] ?? [], fn (array $entry): bool => ($entry['.tag'] ?? null) === 'folder'));
        return array_map(fn (array $entry): array => ['name' => $entry['name'], 'path' => $entry['path_display'] ?? $entry['path_lower']], $folders);
    }

    /** V1-762: updates only the folder path of an existing connection -- unlike connect(), it
     *  never needs the OAuth tokens re-supplied, so the folder picker can call it directly. */
    public function setFolder(User $user, string $folderPath): array
    {
        $connection = $this->connection($user);
        if (! $connection || $connection->status !== 'connected') {
            throw new \LogicException('Dropbox is not connected.');
        }
        DB::table('dropbox_connections')->where('id', $connection->id)->update([
            'folder_path' => $this->normalizeFolder($folderPath),
            'updated_at' => now(),
        ]);
        return $this->status($user);
    }

    public function disconnect(User $user): array
    {
        DB::table('dropbox_connections')->where('user_id', $user->id)->delete();
        return $this->status($user);
    }

    public function connection(User $user): ?object
    {
        return DB::table('dropbox_connections')->where('user_id', $user->id)->first();
    }

    /** Returns a usable access token, transparently refreshing it first when it has expired (V1-762 token renewal). */
    public function accessToken(object $connection): string
    {
        if ($this->isExpired($connection) && $connection->encrypted_refresh_token) {
            return $this->refresh($connection);
        }
        return Crypt::decryptString($connection->encrypted_access_token);
    }

    private function isExpired(object $connection): bool
    {
        return $connection->token_expires_at !== null && now()->greaterThanOrEqualTo($connection->token_expires_at);
    }

    private function refresh(object $connection): string
    {
        $token = $this->gateway->refreshAccessToken(Crypt::decryptString($connection->encrypted_refresh_token));
        $expiresAt = isset($token['expires_in']) ? now()->addSeconds((int) $token['expires_in']) : null;
        DB::table('dropbox_connections')->where('id', $connection->id)->update([
            'encrypted_access_token' => Crypt::encryptString($token['access_token']),
            'token_expires_at' => $expiresAt,
            'updated_at' => now(),
        ]);
        return $token['access_token'];
    }

    private function normalizeFolder(string $folder): string
    {
        $folder = trim($folder);
        return $folder === '' || $folder === '/' ? '/' : '/'.ltrim($folder, '/');
    }
}
