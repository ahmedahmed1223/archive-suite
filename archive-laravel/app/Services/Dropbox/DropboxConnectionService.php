<?php

declare(strict_types=1);

namespace App\Services\Dropbox;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class DropboxConnectionService
{
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

    public function disconnect(User $user): array
    {
        DB::table('dropbox_connections')->where('user_id', $user->id)->delete();
        return $this->status($user);
    }

    private function normalizeFolder(string $folder): string
    {
        $folder = trim($folder);
        return $folder === '' || $folder === '/' ? '/' : '/'.ltrim($folder, '/');
    }
}
