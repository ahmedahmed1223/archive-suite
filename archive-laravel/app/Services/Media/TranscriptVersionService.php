<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Exceptions\TranscriptLockedException;
use App\Models\TranscriptVersion;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use JsonException;
use RuntimeException;
use stdClass;

/**
 * Owns the transcript version history for V3-MEDIA-005: every saved edit or
 * restore creates a new immutable TranscriptVersion row, and the current
 * transcript is always "the latest version for this record". A version
 * marked locked (an explicit certification action, see lock()) can never be
 * overwritten by a plain save/restore -- the caller must pass unlock=true,
 * which is the visible, deliberate action the acceptance criteria requires.
 *
 * Each write also mirrors the flattened cues into storage_rows.data
 * (transcript/transcriptCues/transcriptFormat) so existing readers --
 * TranscriptSearchService, MediaPlayer's transcriptText prop, the legacy
 * RecordTranscriptController endpoints -- keep working unchanged.
 */
final class TranscriptVersionService
{
    private const DEFAULT_STORE = 'archive-items';

    /**
     * @return array{recordStore: string, recordUid: string}
     */
    public function assertRecordExists(string $recordUid, ?string $store = null): array
    {
        $recordStore = $store ?: self::DEFAULT_STORE;

        $exists = DB::table('storage_rows')->where(['store' => $recordStore, 'uid' => $recordUid])->exists();
        if (! $exists) {
            throw new RuntimeException('Record not found.');
        }

        return ['recordStore' => $recordStore, 'recordUid' => $recordUid];
    }

    /**
     * The current transcript: the latest saved version, or -- for records
     * transcribed before this feature existed -- a synthesized read-only
     * view of the legacy storage_rows fields (id null, locked false).
     *
     * @return array{version: TranscriptVersion|null, cues: array<int, array{startSeconds: float, endSeconds: float, text: string}>, format: string, locked: bool}
     */
    public function current(string $recordUid, ?string $store = null): array
    {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);

        $latest = $this->latestVersion($recordStore, $recordUid);
        if ($latest instanceof TranscriptVersion) {
            return ['version' => $latest, 'cues' => $latest->cues ?? [], 'format' => $latest->format, 'locked' => $latest->locked];
        }

        $legacy = $this->legacyState($recordStore, $recordUid);

        return ['version' => null, 'cues' => $legacy['cues'], 'format' => $legacy['format'], 'locked' => false];
    }

    /**
     * @return Collection<int, TranscriptVersion>
     */
    public function listVersions(string $recordUid, ?string $store = null): Collection
    {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);

        return TranscriptVersion::query()
            ->where(['record_store' => $recordStore, 'record_uid' => $recordUid])
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * @param  array<int, array{startSeconds: float, endSeconds: float, text: string}>  $cues
     *
     * @throws TranscriptLockedException when the current version is locked and $unlock is false.
     */
    public function saveVersion(string $recordUid, ?string $store, array $cues, string $format, ?User $actor, bool $unlock = false): TranscriptVersion
    {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);

        $latest = $this->latestVersion($recordStore, $recordUid);
        if ($latest instanceof TranscriptVersion && $latest->locked && ! $unlock) {
            throw new TranscriptLockedException('This transcript is locked. Pass unlock to save changes.');
        }

        $version = DB::transaction(function () use ($recordStore, $recordUid, $cues, $format, $actor): TranscriptVersion {
            $created = TranscriptVersion::query()->create([
                'id' => (string) Str::uuid(),
                'record_store' => $recordStore,
                'record_uid' => $recordUid,
                'format' => $format,
                'cues' => $cues,
                'locked' => false,
                'created_by' => $actor?->getKey(),
            ]);
            $this->mirrorToStorageRow($recordStore, $recordUid, $cues, $format);

            return $created;
        });

        return $version;
    }

    /**
     * Explicit certification action: marks the current transcript locked so
     * later edits/restores are blocked until someone deliberately unlocks
     * it. There must be a saved version to lock -- an unsaved legacy
     * transcript is promoted to a version first.
     */
    public function lock(string $recordUid, ?string $store, ?User $actor): TranscriptVersion
    {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);

        $latest = $this->latestVersion($recordStore, $recordUid);
        if (! $latest instanceof TranscriptVersion) {
            $legacy = $this->legacyState($recordStore, $recordUid);
            $latest = $this->saveVersion($recordUid, $recordStore, $legacy['cues'], $legacy['format'], $actor);
        }

        $latest->locked = true;
        $latest->locked_by = $actor?->getKey();
        $latest->locked_at = now();
        $latest->save();

        return $latest;
    }

    /**
     * Restores a past version by copying its content into a brand-new
     * version (history is never rewritten or deleted). Subject to the same
     * lock check as saveVersion() -- restoring over a locked transcript
     * needs unlock=true too.
     *
     * @throws RuntimeException when the target version does not belong to this record.
     * @throws TranscriptLockedException when the current version is locked and $unlock is false.
     */
    public function restore(string $recordUid, ?string $store, string $versionId, ?User $actor, bool $unlock = false): TranscriptVersion
    {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);

        $target = TranscriptVersion::query()
            ->where(['id' => $versionId, 'record_store' => $recordStore, 'record_uid' => $recordUid])
            ->first();
        if (! $target instanceof TranscriptVersion) {
            throw new RuntimeException('Transcript version not found.');
        }

        $latest = $this->latestVersion($recordStore, $recordUid);
        if ($latest instanceof TranscriptVersion && $latest->locked && ! $unlock) {
            throw new TranscriptLockedException('This transcript is locked. Pass unlock to restore an earlier version.');
        }

        return DB::transaction(function () use ($recordStore, $recordUid, $target, $actor): TranscriptVersion {
            $restored = TranscriptVersion::query()->create([
                'id' => (string) Str::uuid(),
                'record_store' => $recordStore,
                'record_uid' => $recordUid,
                'format' => $target->format,
                'cues' => $target->cues,
                'locked' => false,
                'restored_from_version_id' => $target->id,
                'created_by' => $actor?->getKey(),
            ]);
            $this->mirrorToStorageRow($recordStore, $recordUid, $target->cues ?? [], $target->format);

            return $restored;
        });
    }

    public function export(string $recordUid, ?string $store, string $format): string
    {
        $current = $this->current($recordUid, $store);

        return SubtitleCueCodec::serialize($current['cues'], $format);
    }

    private function latestVersion(string $recordStore, string $recordUid): ?TranscriptVersion
    {
        return TranscriptVersion::query()
            ->where(['record_store' => $recordStore, 'record_uid' => $recordUid])
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * @return array{cues: array<int, array{startSeconds: float, endSeconds: float, text: string}>, format: string}
     */
    private function legacyState(string $recordStore, string $recordUid): array
    {
        $row = DB::table('storage_rows')->where(['store' => $recordStore, 'uid' => $recordUid])->first();
        if (! $row instanceof stdClass) {
            return ['cues' => [], 'format' => 'srt'];
        }

        $data = json_decode((string) $row->data, true) ?: [];
        $cues = is_array($data['transcriptCues'] ?? null) ? $data['transcriptCues'] : [];
        $format = is_string($data['transcriptFormat'] ?? null) ? $data['transcriptFormat'] : 'srt';

        return ['cues' => $cues, 'format' => $format];
    }

    /**
     * @param  array<int, array{startSeconds: float, endSeconds: float, text: string}>  $cues
     *
     * @throws JsonException
     */
    private function mirrorToStorageRow(string $recordStore, string $recordUid, array $cues, string $format): void
    {
        $row = DB::table('storage_rows')->where(['store' => $recordStore, 'uid' => $recordUid])->lockForUpdate()->first();
        if (! $row instanceof stdClass) {
            return;
        }

        $payload = json_decode((string) $row->data, true, 512, JSON_THROW_ON_ERROR);
        $payload = is_array($payload) ? $payload : [];
        $payload['transcript'] = implode("\n", array_column($cues, 'text'));
        $payload['transcriptCues'] = $cues;
        $payload['transcriptFormat'] = $format;

        DB::table('storage_rows')->where(['store' => $recordStore, 'uid' => $recordUid])->update([
            'data' => json_encode($payload, JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }
}
