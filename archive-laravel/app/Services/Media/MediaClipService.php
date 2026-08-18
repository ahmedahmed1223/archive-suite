<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Models\MediaClip;
use App\Models\User;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Non-destructive clip lists for the version-compare studio (V3-MEDIA-004).
 * A clip is just metadata (in/out seconds, title, notes) pinned to a
 * record + version -- it never touches the underlying media file. Version
 * identity is delegated to ReviewSessionService::resolveVersionToken() so
 * clips and review sessions read version pinning identically instead of
 * each feature growing its own notion of "which file is this".
 */
final class MediaClipService
{
    public function __construct(private readonly ReviewSessionService $identity) {}

    /**
     * @return array{recordStore: string, recordUid: string}
     */
    public function assertRecordExists(string $recordUid, ?string $store = null): array
    {
        return $this->identity->assertRecordExists($recordUid, $store);
    }

    public function create(
        string $recordUid,
        ?string $store,
        ?string $attachmentId,
        string $title,
        ?string $notes,
        float $inSeconds,
        float $outSeconds,
        int $fps,
        ?User $actor,
    ): MediaClip {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);

        $clip = new MediaClip([
            'id' => (string) Str::uuid(),
            'record_store' => $recordStore,
            'record_uid' => $recordUid,
            'attachment_id' => $attachmentId,
            'version_token' => $this->identity->resolveVersionToken($recordStore, $recordUid, $attachmentId),
            'title' => $title,
            'notes' => $notes,
            'in_seconds' => $inSeconds,
            'out_seconds' => $outSeconds,
            'fps' => $fps,
            'created_by' => $actor?->getKey(),
        ]);
        $clip->save();

        return $clip;
    }

    /**
     * @param  array<string, mixed>  $fields  Already-validated, camelCase-free (title, notes, inSeconds, outSeconds, fps) subset to apply.
     */
    public function update(MediaClip $clip, array $fields): MediaClip
    {
        if (array_key_exists('title', $fields)) {
            $clip->title = $fields['title'];
        }
        if (array_key_exists('notes', $fields)) {
            $clip->notes = $fields['notes'];
        }
        if (array_key_exists('inSeconds', $fields)) {
            $clip->in_seconds = $fields['inSeconds'];
        }
        if (array_key_exists('outSeconds', $fields)) {
            $clip->out_seconds = $fields['outSeconds'];
        }
        if (array_key_exists('fps', $fields)) {
            $clip->fps = $fields['fps'];
        }

        $clip->save();

        return $clip;
    }

    /**
     * Whether the clip's pinned version_token still matches the record's (or
     * attachment's) live checksum -- mirrors ReviewSessionService::
     * isCurrentVersion(). False means the source was replaced since the
     * clip's in/out times were captured, so they may no longer line up with
     * the live content.
     */
    public function isCurrentVersion(MediaClip $clip): bool
    {
        try {
            return $this->identity->resolveVersionToken($clip->record_store, $clip->record_uid, $clip->attachment_id) === $clip->version_token;
        } catch (RuntimeException) {
            return false;
        }
    }
}
