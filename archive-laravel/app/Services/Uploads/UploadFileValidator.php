<?php

namespace App\Services\Uploads;

use App\Exceptions\UploadContentMismatchException;

/**
 * Content-based upload validation (V1-112). Extension/size are already
 * checked by StoreUploadRequest before this runs; this layer checks the
 * actual bytes so a `.php` renamed to `.jpg` (the classic bypass) is caught
 * even though it declares a valid extension and Content-Type. Uses PHP's
 * fileinfo extension (finfo), already required by Laravel — no new
 * dependency.
 */
class UploadFileValidator
{
    /**
     * Extension => sniffed MIME types that are acceptable for it. Only
     * covers formats with a reliable single-signature magic byte, verified
     * against the actual libmagic build in the project's Docker runtime
     * image. Extensions not listed here (mxf, dv, ts/m2ts/mts, mkv, webm,
     * wmv, flv, legacy doc/xls/ppt OLE containers, txt/md/csv) skip the
     * allow-list match and rely solely on the dangerous-content denylist
     * below — those containers don't have a single reliably-sniffed
     * signature across libmagic builds, and a strict allow-list for them
     * would risk false-positive rejections of real media.
     * ponytail: lenient path for those extensions; promote one into this
     * map (with a verified sample) if a false negative shows up in practice.
     */
    private const RELIABLE_MIME_MAP = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'gif' => ['image/gif'],
        'pdf' => ['application/pdf'],
        'zip' => ['application/zip', 'application/x-zip-compressed'],
        'docx' => [
            'application/zip', 'application/x-zip-compressed',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        'xlsx' => [
            'application/zip', 'application/x-zip-compressed',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        'pptx' => [
            'application/zip', 'application/x-zip-compressed',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        'mp4' => ['video/mp4'],
        'mov' => ['video/quicktime', 'video/mp4'],
        'avi' => ['video/x-msvideo'],
    ];

    /**
     * Sniffed MIME types that always indicate script/executable content —
     * rejected no matter what extension the upload claims.
     */
    private const DANGEROUS_MIME_TYPES = [
        'text/x-php',
        'application/x-httpd-php',
        'text/x-python',
        'text/x-perl',
        'text/x-rubysrc',
        'text/x-shellscript',
        'application/x-sh',
        'application/x-executable',
        'application/x-sharedlib',
        'application/x-dosexec',
        'application/x-mach-binary',
        'application/x-elf',
        'application/java-archive',
        'text/x-msdos-batch',
    ];

    /**
     * @param  string  $sampleBytes  first chunk of the file's real content (e.g. first 8KB)
     * @param  string  $extension  claimed extension, without leading dot
     *
     * @throws UploadContentMismatchException
     */
    public function assertSafeContent(string $sampleBytes, string $extension): void
    {
        $detected = $this->detectMimeType($sampleBytes);
        $extension = strtolower(ltrim($extension, '.'));

        if (in_array($detected, self::DANGEROUS_MIME_TYPES, true)) {
            throw new UploadContentMismatchException(
                "Upload rejected: detected content type '{$detected}' is not allowed.",
            );
        }

        $allowed = self::RELIABLE_MIME_MAP[$extension] ?? null;

        if ($allowed !== null && ! in_array($detected, $allowed, true)) {
            throw new UploadContentMismatchException(
                "Upload rejected: file content ({$detected}) does not match its .{$extension} extension.",
            );
        }
    }

    private function detectMimeType(string $sampleBytes): string
    {
        if ($sampleBytes === '') {
            // Empty file: nothing to sniff, and nothing dangerous either.
            return 'inode/x-empty';
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);

        if ($finfo === false) {
            // Fail closed: without fileinfo we cannot verify safety.
            throw new UploadContentMismatchException('Upload rejected: unable to inspect file content.');
        }

        try {
            $detected = finfo_buffer($finfo, $sampleBytes);

            return $detected !== false ? $detected : 'application/octet-stream';
        } finally {
            finfo_close($finfo);
        }
    }
}
