<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use FilesystemIterator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

// V1-853: files present under the configured archive file root that are not
// referenced by any record_attachments row. Read-only — never deletes
// anything, only surfaces candidates for a safe manual review.
// ponytail: cross-checks record_attachments.path only, not legacy inline
// source paths some older records may carry directly in their JSON — a
// second reference format is out of scope here without more investigation.
class UnusedFilesController extends Controller
{
    public function index(): JsonResponse
    {
        $root = rtrim((string) config('archive.file_root'), DIRECTORY_SEPARATOR);
        if (! is_dir($root)) {
            return response()->json(['ok' => true, 'files' => []]);
        }

        $referenced = DB::table('record_attachments')->pluck('path')->flip();

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        );
        $unused = [];

        foreach ($iterator as $file) {
            if (! $file instanceof SplFileInfo || ! $file->isFile()) continue;

            $relative = ltrim(str_replace($root, '', $file->getPathname()), DIRECTORY_SEPARATOR);
            $relative = str_replace('\\', '/', $relative);

            if ($referenced->has($relative)) continue;

            $unused[] = [
                'key' => $relative,
                'name' => $file->getFilename(),
                'size' => $file->getSize(),
                'modifiedAt' => date(DATE_ATOM, $file->getMTime()),
                'reason' => 'no_attachment_reference',
            ];

            if (count($unused) >= 200) break;
        }

        return response()->json(['ok' => true, 'files' => $unused]);
    }
}
