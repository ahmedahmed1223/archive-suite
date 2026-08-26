<?php

namespace App\Domain\Montage;

use App\Models\User;
use App\Services\Media\MediaPathGuard;
use App\Services\Media\ReviewSessionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use JsonException;
use stdClass;

/** Resolves client media identities to version-pinned server storage handles. */
class MontageSourceResolver
{
    private const RECORD_STORE = 'archive-items';

    public function __construct(private readonly ReviewSessionService $versions) {}

    /**
     * @param  array<string, mixed>  $source
     * @return array<string, mixed>
     */
    public function resolve(array $source, User $actor, int $clipIndex): array
    {
        if (! in_array($actor->role, ['admin', 'editor'], true)) {
            throw new MontageValidationException([
                "clips.$clipIndex.source.recordId" => 'The actor is not authorized to export source media.',
            ]);
        }

        $extra = array_diff(array_keys($source), ['recordId', 'sourceVersionToken', 'attachmentId']);
        if ($extra !== []) {
            throw new MontageValidationException([
                "clips.$clipIndex.source" => 'Source accepts recordId, attachmentId, and sourceVersionToken only.',
            ]);
        }

        $recordId = $source['recordId'] ?? null;
        $requestedToken = $source['sourceVersionToken'] ?? null;
        $attachmentId = $source['attachmentId'] ?? null;
        if (! is_string($recordId) || trim($recordId) === '' || ! is_string($requestedToken) || $requestedToken === '') {
            throw new MontageValidationException([
                "clips.$clipIndex.source" => 'A record id and pinned source version token are required.',
            ]);
        }
        if ($attachmentId !== null && (! is_string($attachmentId) || $attachmentId === '')) {
            throw new MontageValidationException([
                "clips.$clipIndex.source.attachmentId" => 'Attachment id must be a non-empty string when supplied.',
            ]);
        }

        $record = DB::table('storage_rows')
            ->where(['store' => self::RECORD_STORE, 'uid' => $recordId])
            ->first();
        if (! $record instanceof stdClass) {
            throw new MontageValidationException([
                "clips.$clipIndex.source.recordId" => 'Source record was not found.',
            ]);
        }

        try {
            $resolvedToken = $this->versions->resolveVersionToken(self::RECORD_STORE, $recordId, $attachmentId);
        } catch (\RuntimeException) {
            throw new MontageValidationException([
                "clips.$clipIndex.source.attachmentId" => 'Source attachment was not found for this record.',
            ]);
        }
        if (! hash_equals($resolvedToken, $requestedToken)) {
            throw new MontageValidationException([
                "clips.$clipIndex.source.sourceVersionToken" => 'Source version no longer matches the pinned revision.',
            ]);
        }

        if ($attachmentId !== null) {
            $attachment = DB::table('record_attachments')
                ->where([
                    'id' => $attachmentId,
                    'record_store' => self::RECORD_STORE,
                    'record_uid' => $recordId,
                ])->first();
            if (! $attachment instanceof stdClass || $attachment->processing_status !== 'ready') {
                throw new MontageValidationException([
                    "clips.$clipIndex.source.attachmentId" => 'Source attachment is not ready for export.',
                ]);
            }

            return $this->storageHandle(
                recordId: $recordId,
                attachmentId: $attachmentId,
                token: $resolvedToken,
                disk: (string) $attachment->disk,
                path: (string) $attachment->path,
                name: (string) $attachment->original_name,
                mimeType: is_string($attachment->mime_type) ? $attachment->mime_type : null,
                sizeBytes: (int) $attachment->size_bytes,
                clipIndex: $clipIndex,
            );
        }

        try {
            $data = json_decode((string) $record->data, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new MontageValidationException([
                "clips.$clipIndex.source.recordId" => 'Source record metadata is invalid.',
            ]);
        }

        return $this->storageHandle(
            recordId: $recordId,
            attachmentId: null,
            token: $resolvedToken,
            disk: 'local',
            path: is_string($data['filePath'] ?? null) ? $data['filePath'] : '',
            name: is_string($data['fileName'] ?? null) ? $data['fileName'] : '',
            mimeType: is_string($data['mimeType'] ?? null) ? $data['mimeType'] : null,
            sizeBytes: is_numeric($data['sizeBytes'] ?? null) ? (int) $data['sizeBytes'] : 0,
            clipIndex: $clipIndex,
        );
    }

    /** @return array<string, mixed> */
    private function storageHandle(
        string $recordId,
        ?string $attachmentId,
        string $token,
        string $disk,
        string $path,
        string $name,
        ?string $mimeType,
        int $sizeBytes,
        int $clipIndex,
    ): array {
        if ($disk !== 'local' || ! MediaPathGuard::isSafeRelative($path)) {
            throw new MontageValidationException([
                "clips.$clipIndex.source.recordId" => 'Source is not on supported, contained media storage.',
            ]);
        }
        if (! Storage::disk($disk)->exists($path)) {
            throw new MontageValidationException([
                "clips.$clipIndex.source.recordId" => 'Source media is unavailable on storage.',
            ]);
        }

        return [
            'recordStore' => self::RECORD_STORE,
            'recordId' => $recordId,
            'attachmentId' => $attachmentId,
            'sourceVersionToken' => $token,
            'disk' => $disk,
            'path' => $path,
            'name' => $name,
            'mimeType' => $mimeType,
            'sizeBytes' => $sizeBytes,
        ];
    }
}
