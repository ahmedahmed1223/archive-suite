<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Models\MediaDerivative;
use App\Models\MediaJob;
use App\Models\User;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Cached, version-pinned media derivatives -- thumbnail, waveform, and
 * lightweight preview (proxy) copies (V3-MEDIA-006). A derivative is keyed
 * on the source's checksum-derived version identity --
 * ReviewSessionService::resolveVersionToken(), the exact pattern review
 * sessions (V3-MEDIA-002) and clips (V3-MEDIA-004) already share -- plus a
 * hash of the generation settings, so regenerating with different settings
 * never collides with a derivative cached under different ones, and a
 * derivative generated against a replaced source is never silently served
 * as current. See isCurrentVersion().
 */
final class MediaDerivativeService
{
    /**
     * A persisted row only ever reaches the database via attachJob(), which
     * always writes 'processing' -- so 'pending' never actually appears
     * here for an *existing* row (findOrBuildPending's own in-memory
     * pending build is what 'isNew' communicates instead). Listed anyway as
     * a defensive/forward-compatible floor, not a reachable case today.
     *
     * @var list<string>
     */
    private const USABLE_STATUSES = ['pending', 'processing', 'ready'];

    public function __construct(private readonly ReviewSessionService $identity) {}

    /**
     * @return array{recordStore: string, recordUid: string}
     */
    public function assertRecordExists(string $recordUid, ?string $store = null): array
    {
        return $this->identity->assertRecordExists($recordUid, $store);
    }

    /**
     * Resolves (or creates) the MediaDerivative row for this exact
     * record/attachment + type + live version + settings combination.
     *
     * - A row already ready or in flight (pending/processing) is returned
     *   as-is -- isNew=false -- so the caller never dispatches a duplicate
     *   MediaJob for work that is already cached or already running.
     * - A previously failed attempt is reset in place and reported as
     *   isNew=true so the caller dispatches a fresh MediaJob for it.
     * - Otherwise an in-memory (not yet persisted) pending row is built,
     *   isNew=true. It is deliberately NOT saved here: the caller still has
     *   a backpressure check to run before committing to new work, and
     *   persisting a row that a 429 then abandons would leave it sitting in
     *   'pending' forever -- a later identical request would treat that
     *   orphan as already in flight (status is in USABLE_STATUSES) and
     *   never actually retry it. attachJob() below is what actually
     *   persists it, once a MediaJob has genuinely been dispatched.
     *
     * @param  array<string, mixed>  $settings
     * @return array{derivative: MediaDerivative, isNew: bool}
     */
    public function findOrBuildPending(
        string $recordUid,
        ?string $store,
        ?string $attachmentId,
        string $type,
        array $settings,
        ?User $actor,
    ): array {
        ['recordStore' => $recordStore, 'recordUid' => $recordUid] = $this->assertRecordExists($recordUid, $store);
        $versionToken = $this->identity->resolveVersionToken($recordStore, $recordUid, $attachmentId);
        $settingsHash = self::hashSettings($settings);

        $existing = MediaDerivative::query()
            ->where('record_store', $recordStore)
            ->where('record_uid', $recordUid)
            ->where('attachment_id', $attachmentId)
            ->where('derivative_type', $type)
            ->where('version_token', $versionToken)
            ->where('settings_hash', $settingsHash)
            ->first();

        if ($existing instanceof MediaDerivative) {
            if (in_array($existing->status, self::USABLE_STATUSES, true)) {
                return ['derivative' => $existing, 'isNew' => false];
            }

            // Previously failed: retry against the same cache-key row
            // instead of growing a duplicate. Reset in memory only --
            // attachJob() persists it once dispatch actually happens.
            $existing->forceFill([
                'status' => 'pending',
                'error' => null,
                'storage_key' => null,
                'media_job_id' => null,
            ]);

            return ['derivative' => $existing, 'isNew' => true];
        }

        $derivative = new MediaDerivative([
            'id' => (string) Str::uuid(),
            'record_store' => $recordStore,
            'record_uid' => $recordUid,
            'attachment_id' => $attachmentId,
            'derivative_type' => $type,
            'version_token' => $versionToken,
            'settings' => $settings,
            'settings_hash' => $settingsHash,
            'status' => 'pending',
            'created_by' => $actor?->getKey(),
        ]);

        return ['derivative' => $derivative, 'isNew' => true];
    }

    /**
     * Persists the derivative and records which MediaJob is generating it --
     * called once the caller has actually created and dispatched
     * ProcessMediaWorkflow for it (i.e. past the backpressure check). This
     * is the first save() for a brand-new or failed-retry row from
     * findOrBuildPending(). The job's own lifecycle
     * (ProcessMediaWorkflow::handle()/failed()) later calls
     * markReady()/markFailed() when it settles.
     */
    public function attachJob(MediaDerivative $derivative, MediaJob $job): void
    {
        $derivative->forceFill([
            'status' => 'processing',
            'media_job_id' => $job->id,
        ])->save();
    }

    public function markReady(MediaDerivative $derivative, string $storageKey): void
    {
        $derivative->forceFill([
            'status' => 'ready',
            'storage_key' => $storageKey,
            'error' => null,
        ])->save();
    }

    public function markFailed(MediaDerivative $derivative, string $error): void
    {
        $derivative->forceFill([
            'status' => 'failed',
            'error' => $error,
        ])->save();
    }

    /**
     * Whether the derivative's pinned version_token still matches the
     * record's (or attachment's) live checksum -- mirrors
     * ReviewSessionService::isCurrentVersion() and MediaClipService::
     * isCurrentVersion(). False means the source was replaced since this
     * derivative was generated, so it must not be presented as matching the
     * current source.
     */
    public function isCurrentVersion(MediaDerivative $derivative): bool
    {
        try {
            return $this->identity->resolveVersionToken(
                $derivative->record_store,
                $derivative->record_uid,
                $derivative->attachment_id,
            ) === $derivative->version_token;
        } catch (RuntimeException) {
            return false;
        }
    }

    /**
     * sha256 of the settings, normalized (recursively key-sorted) first so
     * two logically-identical settings payloads with keys in a different
     * order still hash identically.
     *
     * @param  array<string, mixed>  $settings
     */
    public static function hashSettings(array $settings): string
    {
        return hash('sha256', json_encode(self::normalize($settings), JSON_THROW_ON_ERROR));
    }

    /**
     * @param  array<array-key, mixed>  $value
     * @return array<array-key, mixed>
     */
    private static function normalize(array $value): array
    {
        ksort($value);
        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $value[$key] = self::normalize($item);
            }
        }

        return $value;
    }
}
