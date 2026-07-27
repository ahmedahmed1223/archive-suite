<?php

declare(strict_types=1);

namespace App\Services\Storage;

use Illuminate\Support\Arr;

/**
 * The public, secret-free view of configured storage locations.
 *
 * Credentials deliberately never leave this class: callers receive an opaque
 * provider id, its type, availability, and the actions it can perform.
 */
final class StorageCatalog
{
    /** @return list<array{id:string,type:string,label:string,capabilities:list<string>,status:string}> */
    public function entries(): array
    {
        $disks = (array) config('filesystems.disks', []);
        $entries = [];

        foreach ($disks as $id => $disk) {
            $driver = (string) Arr::get($disk, 'driver', '');
            $type = match ($driver) {
                'local' => 'local',
                's3' => 's3',
                'dropbox' => 'dropbox',
                default => null,
            };

            if ($type === null) {
                continue;
            }

            $configured = $this->configured($type, $disk);
            $entries[] = [
                'id' => (string) $id,
                'type' => $type,
                'label' => $this->label((string) $id, $type),
                'capabilities' => $this->capabilities($type, $configured),
                'status' => $configured ? 'available' : 'not_configured',
            ];
        }

        return $entries;
    }

    /** @param array<string, mixed> $disk */
    private function configured(string $type, array $disk): bool
    {
        return match ($type) {
            'local' => filled($disk['root'] ?? null),
            's3' => filled($disk['bucket'] ?? null) && filled($disk['key'] ?? null) && filled($disk['secret'] ?? null),
            // OAuth connections are user-scoped; an application token is enough
            // to advertise a configured service without exposing that token.
            'dropbox' => filled($disk['token'] ?? null)
                || (filled(config('services.dropbox.client_id')) && filled(config('services.dropbox.client_secret'))),
            default => false,
        };
    }

    /** @return list<string> */
    private function capabilities(string $type, bool $configured): array
    {
        if (! $configured) {
            return [];
        }

        return match ($type) {
            'local', 's3', 'dropbox' => ['browse', 'download', 'upload', 'create_folder', 'rename', 'copy', 'move', 'delete', 'restore', 'checksum'],
            default => [],
        };
    }

    private function label(string $id, string $type): string
    {
        return match ($type) {
            'local' => $id === 'local' ? 'التخزين المحلي' : $id,
            's3' => $id === 's3' ? 'Amazon S3' : $id,
            'dropbox' => $id === 'dropbox' ? 'Dropbox' : $id,
            default => $id,
        };
    }
}
