<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use stdClass;

/**
 * V1-714: bulk record export/import via CSV. Records live in the schemaless
 * `storage_rows` table (composite key [store, uid], JSON `data`) — same
 * access pattern as TrashController. Import is update-only: it never creates
 * a uid, and only touches columns present in the uploaded file's header.
 */
class RecordsBulkCsvController extends Controller
{
    /** Columns accepted on export/import; anything else in a file is rejected. */
    private const COLUMNS = ['uid', 'title', 'description', 'type', 'subtype', 'status', 'tags'];

    public function export(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'store' => ['required', 'string'],
        ]);

        $store = (string) $validated['store'];

        return response()->streamDownload(function () use ($store): void {
            $csv = implode(',', self::COLUMNS)."\n";

            $rows = DB::table('storage_rows')->where('store', $store)->orderBy('uid')->get();

            foreach ($rows as $row) {
                /** @var stdClass $row */
                $data = json_decode((string) $row->data, true);
                $payload = is_array($data) ? $data : [];
                $csv .= $this->csvLine($row->uid, $payload);
            }

            echo $csv;
        }, 'records-export.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * @throws ValidationException
     */
    public function import(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'store' => ['required', 'string'],
            'file' => ['required', 'file', 'max:5120'], // 5 MB
        ]);

        $dryRun = $request->boolean('dryRun');
        $store = (string) $validated['store'];
        $content = (string) file_get_contents((string) $request->file('file')?->getRealPath());

        $parsed = $this->parseCsv($content);
        if ($parsed['errors'] !== []) {
            return response()->json([
                ...ApiError::envelope('Import file contains invalid rows.', 422, 'validation_failed'),
                'rowErrors' => $parsed['errors'],
            ], 422);
        }

        $now = now();
        $results = [];

        $apply = function () use ($parsed, $store, $now, &$results, $dryRun): void {
            foreach ($parsed['rows'] as $importRow) {
                $uid = $importRow['fields']['uid'];
                $existing = DB::table('storage_rows')->where('store', $store)->where('uid', $uid)->first();

                if (! $existing instanceof stdClass) {
                    $results[] = ['uid' => $uid, 'accepted' => false, 'reason' => 'not_found'];

                    continue;
                }

                if (! $dryRun) {
                    $data = json_decode((string) $existing->data, true);
                    $data = is_array($data) ? $data : [];

                    foreach ($importRow['fields'] as $column => $value) {
                        if ($column === 'uid') {
                            continue; // key, never rewritten
                        }

                        $data[$column] = $column === 'tags' ? $this->splitTags($value) : $value;
                    }

                    DB::table('storage_rows')
                        ->where('store', $store)
                        ->where('uid', $uid)
                        ->update([
                            'data' => json_encode($data, JSON_THROW_ON_ERROR),
                            'updated_at' => $now,
                        ]);
                }

                $results[] = ['uid' => $uid, 'accepted' => true];
            }
        };

        if ($dryRun) {
            $apply();
        } else {
            DB::transaction($apply);
        }

        $accepted = count(array_filter($results, fn (array $r): bool => $r['accepted']));

        return response()->json([
            'ok' => true,
            'dryRun' => $dryRun,
            'accepted' => $accepted,
            'rejected' => count($results) - $accepted,
            'results' => $results,
        ]);
    }

    /**
     * @return array{rows: array<int, array{fields: array<string, string>}>, errors: array<int, string>}
     */
    private function parseCsv(string $content): array
    {
        $stream = fopen('php://temp', 'r+');
        fwrite($stream, $content);
        rewind($stream);

        $header = fgetcsv($stream);
        if ($header === false || $header === null) {
            fclose($stream);

            return ['rows' => [], 'errors' => ['File is empty.']];
        }

        $header = array_map(fn ($h): string => strtolower(trim((string) $h)), $header);
        $unknown = array_diff($header, self::COLUMNS);
        if ($unknown !== []) {
            fclose($stream);

            return ['rows' => [], 'errors' => ['Unknown column(s): '.implode(', ', $unknown).'.']];
        }
        if (! in_array('uid', $header, true)) {
            fclose($stream);

            return ['rows' => [], 'errors' => ['Missing required "uid" column.']];
        }

        $rows = [];
        $errors = [];
        $rowNumber = 0;

        while (($data = fgetcsv($stream)) !== false) {
            $rowNumber++;
            if ($data === [null]) {
                continue; // blank line
            }

            $assoc = array_combine($header, array_pad($data, count($header), null));
            $uid = trim((string) ($assoc['uid'] ?? ''));

            if ($uid === '') {
                $errors[] = "Row {$rowNumber}: uid is required.";

                continue;
            }

            $fields = ['uid' => $uid];
            foreach ($header as $column) {
                if ($column === 'uid') {
                    continue;
                }
                $fields[$column] = trim((string) ($assoc[$column] ?? ''));
            }

            $rows[] = ['fields' => $fields];
        }

        fclose($stream);

        return ['rows' => $rows, 'errors' => $errors];
    }

    /**
     * @return array<int, string>
     */
    private function splitTags(string $tags): array
    {
        return array_values(array_filter(array_map('trim', explode(';', $tags)), fn ($t): bool => $t !== ''));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function csvLine(string $uid, array $payload): string
    {
        $tags = is_array($payload['tags'] ?? null) ? implode(';', $payload['tags']) : (string) ($payload['tags'] ?? '');

        $fields = [
            $uid,
            (string) ($payload['title'] ?? ''),
            (string) ($payload['description'] ?? ''),
            (string) ($payload['type'] ?? ''),
            (string) ($payload['subtype'] ?? ''),
            (string) ($payload['status'] ?? ''),
            $tags,
        ];

        $escaped = array_map(function ($field): string {
            $field = (string) $field;

            return preg_match('/[",\n]/', $field) === 1
                ? '"'.str_replace('"', '""', $field).'"'
                : $field;
        }, $fields);

        return implode(',', $escaped)."\n";
    }
}
