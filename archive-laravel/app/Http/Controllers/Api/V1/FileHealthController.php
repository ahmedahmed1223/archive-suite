<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use stdClass;

// V1-860: on-demand checksum verification history per attachment, so a
// silent bit-rot/corruption issue shows up in the record context instead of
// only surfacing when someone tries to open the file.
class FileHealthController extends Controller
{
    public function index(string $attachmentId): JsonResponse
    {
        $attachment = DB::table('record_attachments')->where('id', $attachmentId)->first();
        if (! $attachment) {
            return $this->notFound();
        }

        $checks = DB::table('file_health_checks')
            ->where('attachment_id', $attachmentId)
            ->orderByDesc('checked_at')
            ->get()
            ->map(fn (stdClass $check): array => $this->format($check))
            ->values();

        return response()->json(['ok' => true, 'checks' => $checks]);
    }

    public function check(string $attachmentId): JsonResponse
    {
        $attachment = DB::table('record_attachments')->where('id', $attachmentId)->first();
        if (! $attachment) {
            return $this->notFound();
        }

        $status = 'missing';
        $checksum = null;
        try {
            if (Storage::disk($attachment->disk)->exists($attachment->path)) {
                $checksum = hash_file('sha256', Storage::disk($attachment->disk)->path($attachment->path));
                $status = $checksum === $attachment->checksum_sha256 ? 'match' : 'mismatch';
            }
        } catch (\Throwable) {
            $status = 'error';
        }

        $now = now();
        $id = (string) Str::uuid();
        DB::table('file_health_checks')->insert([
            'id' => $id,
            'attachment_id' => $attachmentId,
            'status' => $status,
            'checksum_sha256' => $checksum,
            'checked_at' => $now,
        ]);

        $check = DB::table('file_health_checks')->where('id', $id)->first();

        return response()->json(['ok' => true, 'check' => $this->format($check)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function format(stdClass $check): array
    {
        return [
            'id' => $check->id,
            'attachmentId' => $check->attachment_id,
            'status' => $check->status,
            'checksumSha256' => $check->checksum_sha256,
            'checkedAt' => $check->checked_at,
        ];
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Attachment not found.', 'code' => 'not_found'], 404);
    }
}
