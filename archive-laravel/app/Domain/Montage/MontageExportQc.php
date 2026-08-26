<?php

namespace App\Domain\Montage;

use App\Models\MontageProjectRevision;
use Illuminate\Support\Facades\Storage;

/** Pre-queue checks that must pass before durable render work is created. */
class MontageExportQc
{
    public function assertReady(MontageProjectRevision $revision, MontageRenderManifest $manifest): void
    {
        $errors = [];
        $clips = is_array($revision->clips) ? $revision->clips : [];
        foreach (is_array($revision->tracks) ? $revision->tracks : [] as $index => $track) {
            if (! is_array($track) || ($track['required'] ?? false) !== true) {
                continue;
            }
            $kind = $track['kind'] ?? null;
            if (! in_array($kind, ['audio', 'subtitle', 'caption'], true)) {
                continue;
            }
            $trackId = $track['id'] ?? "track-$index";
            $hasSource = collect($clips)->contains(
                static fn (mixed $clip): bool => is_array($clip) && ($clip['trackId'] ?? null) === $trackId,
            );
            if (! $hasSource) {
                $errors["tracks.$trackId"] = "Requested $kind track has no source clips.";
            }
        }
        if ($errors !== []) {
            throw new MontageValidationException($errors);
        }

        $this->assertStorageAvailable($manifest);
    }

    public function assertStorageAvailable(MontageRenderManifest $manifest): void
    {
        $root = Storage::disk('local')->path('');
        $freeBytes = @disk_free_space($root);
        if ($freeBytes === false) {
            return;
        }

        $estimatedOutputBytes = max(1, array_sum(array_map(
            static fn (array $source): int => max(0, (int) ($source['sizeBytes'] ?? 0)),
            $manifest->sources,
        )));
        $minimumFreeBytes = (int) config('media.montage_min_free_bytes', 100 * 1024 * 1024);
        if ($freeBytes - $estimatedOutputBytes < $minimumFreeBytes) {
            throw new MontageValidationException([
                'storage' => 'Not enough free storage is available for this export.',
            ]);
        }
    }
}
