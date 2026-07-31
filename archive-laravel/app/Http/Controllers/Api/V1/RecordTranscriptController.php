<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use JsonException;
use stdClass;

class RecordTranscriptController extends Controller
{
    public function updateSubtitles(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:1000000'],
            'format' => ['required', 'string', 'in:srt,vtt'],
            'store' => ['nullable', 'string'],
            'style' => ['nullable', 'array'],
            'style.fontSize' => ['nullable', 'integer', 'min:12', 'max:72'],
            'style.color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'style.align' => ['nullable', 'string', 'in:start,middle,end'],
        ]);
        $cues = $this->parseSrt($validated['content']);
        if ($cues === []) {
            return response()->json(ApiError::envelope('The subtitle content contains no valid timed cues.', 422), 422);
        }

        $row = $this->saveCues($id, $validated, $cues, $validated['format'], $validated['style'] ?? null);
        if (! $row instanceof stdClass) {
            return response()->json(ApiError::envelope('Record not found.', 404, 'not_found'), 404);
        }

        return response()->json(['ok' => true, 'record' => StorageRowPayload::format($row)]);
    }

    public function importSrt(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:5120', 'extensions:srt,vtt'],
            'store' => ['nullable', 'string'],
        ]);
        $cues = $this->parseSrt((string) file_get_contents((string) $request->file('file')?->getRealPath()));
        $format = strtolower((string) $request->file('file')?->getClientOriginalExtension());
        if ($cues === []) {
            return response()->json(ApiError::envelope('The SRT file contains no valid timed cues.', 422), 422);
        }

        $row = $this->saveCues($id, $validated, $cues, $format);
        if (! $row instanceof stdClass) {
            return response()->json(ApiError::envelope('Record not found.', 404, 'not_found'), 404);
        }

        return response()->json(['ok' => true, 'record' => StorageRowPayload::format($row)]);
    }

    /** @param array<string, mixed> $validated @param array<int, array{startSeconds: float, endSeconds: float, text: string}> $cues @param array<string, mixed>|null $style */
    private function saveCues(string $id, array $validated, array $cues, string $format, ?array $style = null): ?stdClass
    {
        return DB::transaction(function () use ($id, $validated, $cues, $format, $style): ?stdClass {
            $row = DB::table('storage_rows')
                ->when(isset($validated['store']), fn ($query) => $query->where('store', $validated['store']))
                ->where(function ($query) use ($id): void {
                    $query->where('uid', $id)->orWhere('data->id', $id);
                })
                ->lockForUpdate()
                ->first();
            if (! $row instanceof stdClass) {
                return null;
            }

            $payload = json_decode((string) $row->data, true, 512, JSON_THROW_ON_ERROR);
            $payload = is_array($payload) ? $payload : [];
            $payload['transcript'] = implode("\n", array_column($cues, 'text'));
            $payload['transcriptCues'] = $cues;
            $payload['transcriptFormat'] = $format;
            if ($style !== null) {
                $payload['transcriptStyle'] = $style;
            }
            $now = now();
            DB::table('storage_rows')->where('store', $row->store)->where('uid', $row->uid)->update([
                'data' => json_encode($payload, JSON_THROW_ON_ERROR), 'updated_at' => $now,
            ]);
            $row->data = json_encode($payload, JSON_THROW_ON_ERROR);
            $row->updated_at = $now;

            return $row;
        });
    }

    /**
     * @throws JsonException
     */
    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'transcript' => ['required', 'string', 'max:1000000'],
            'store' => ['nullable', 'string'],
        ]);

        if (trim($validated['transcript']) === '') {
            return response()->json([
                'message' => 'The transcript field must not be blank.',
                'errors' => ['transcript' => ['The transcript field must not be blank.']],
            ], 422);
        }

        $row = DB::transaction(function () use ($id, $validated): ?stdClass {
            $row = DB::table('storage_rows')
                ->when(isset($validated['store']), fn ($query) => $query->where('store', $validated['store']))
                ->where(function ($query) use ($id): void {
                    $query->where('uid', $id)
                        ->orWhere('data->id', $id);
                })
                ->lockForUpdate()
                ->first();

            if (! $row instanceof stdClass) {
                return null;
            }

            $payload = json_decode((string) $row->data, true, 512, JSON_THROW_ON_ERROR);
            $payload = is_array($payload) ? $payload : [];
            $payload['transcript'] = $validated['transcript'];
            $now = now();

            DB::table('storage_rows')
                ->where('store', $row->store)
                ->where('uid', $row->uid)
                ->update([
                    'data' => json_encode($payload, JSON_THROW_ON_ERROR),
                    'updated_at' => $now,
                ]);

            $row->data = json_encode($payload, JSON_THROW_ON_ERROR);
            $row->updated_at = $now;

            return $row;
        });

        if (! $row instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Record not found.',
                'code' => 'not_found',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'record' => StorageRowPayload::format($row),
        ]);
    }

    /** @return array<int, array{startSeconds: float, endSeconds: float, text: string}> */
    private function parseSrt(string $content): array
    {
        $cues = [];
        foreach (preg_split('/\R{2,}/u', trim($content)) ?: [] as $block) {
            $lines = preg_split('/\R/u', trim($block)) ?: [];
            $timeIndex = null;
            foreach ($lines as $index => $line) {
                if (str_contains($line, '-->')) {
                    $timeIndex = $index;
                    break;
                }
            }
            if ($timeIndex === null || ! preg_match('/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/u', trim($lines[$timeIndex]), $match)) {
                continue;
            }
            $text = trim(implode("\n", array_slice($lines, $timeIndex + 1)));
            if ($text === '') {
                continue;
            }
            $cues[] = [
                'startSeconds' => $this->seconds($match[1], $match[2], $match[3], $match[4]),
                'endSeconds' => $this->seconds($match[5], $match[6], $match[7], $match[8]),
                'text' => $text,
            ];
        }

        return $cues;
    }

    private function seconds(string $hours, string $minutes, string $seconds, string $milliseconds): float
    {
        return ((int) $hours * 3600) + ((int) $minutes * 60) + (int) $seconds + ((int) $milliseconds / 1000);
    }
}
