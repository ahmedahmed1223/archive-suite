<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class VocabularyController extends Controller
{
    private const KINDS = ['type', 'tag', 'custom'];

    /** Columns accepted on export/import; anything else in a file is rejected. */
    private const IMPORT_COLUMNS = ['term', 'kind', 'aliases', 'note'];

    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);

        $terms = DB::table('vocabulary_terms')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatTerm($row))
            ->values();

        return response()->json(['ok' => true, 'terms' => $terms]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'term' => ['required', 'string', 'max:200'],
            'kind' => ['nullable', 'string', 'in:'.implode(',', self::KINDS)],
            'aliases' => ['nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('vocabulary_terms')->insert([
            'id' => $id,
            'user_id' => $userId,
            'term' => trim((string) $validated['term']),
            'kind' => $validated['kind'] ?? 'custom',
            'aliases' => $validated['aliases'] ?? null,
            'note' => $validated['note'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'ok' => true,
            'term' => $this->formatTerm(DB::table('vocabulary_terms')->where('id', $id)->first()),
        ], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $userId = $this->userId($request);

        $deleted = DB::table('vocabulary_terms')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        if ($deleted < 1) {
            return response()->json([
                'ok' => false,
                'error' => 'Vocabulary term not found.',
                'code' => 'not_found',
            ], 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    public function export(Request $request): JsonResponse|Response
    {
        $format = (string) $request->query('format', 'json');

        if (! in_array($format, ['csv', 'json'], true)) {
            return response()->json(ApiError::envelope('Invalid format. Use csv or json.', 422), 422);
        }

        $terms = DB::table('vocabulary_terms')
            ->where('user_id', $this->userId($request))
            ->orderBy('term')
            ->get();

        if ($format === 'json') {
            return response()->json([
                'ok' => true,
                'terms' => $terms->map(fn (stdClass $row): array => $this->formatTerm($row))->values(),
            ]);
        }

        $csv = "term,kind,aliases,note\n";
        foreach ($terms as $row) {
            $csv .= $this->csvLine([$row->term, $row->kind, $row->aliases ?? '', $row->note ?? '']);
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="vocabulary-export.csv"',
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $request->validate([
            'file' => ['required', 'file', 'max:5120'], // 5 MB
            'format' => ['required', 'string', 'in:csv,json'],
        ]);

        $dryRun = $request->boolean('dryRun');
        $content = (string) file_get_contents((string) $request->file('file')?->getRealPath());

        $parsed = $request->string('format')->toString() === 'csv'
            ? $this->parseCsvImport($content)
            : $this->parseJsonImport($content);

        if ($parsed['errors'] !== []) {
            return response()->json([
                ...ApiError::envelope('Import file contains invalid rows.', 422, 'validation_failed'),
                'rowErrors' => $parsed['errors'],
            ], 422);
        }

        $userId = $this->userId($request);
        $now = now();

        $byTermKey = [];
        foreach (DB::table('vocabulary_terms')->where('user_id', $userId)->get() as $row) {
            $byTermKey[mb_strtolower(trim($row->term))] = $row;
        }

        $created = [];
        $merged = [];

        $apply = function () use ($parsed, &$byTermKey, $userId, $now, &$created, &$merged, $dryRun): void {
            foreach ($parsed['rows'] as $importRow) {
                $key = mb_strtolower($importRow['term']);
                $existing = $byTermKey[$key] ?? null;

                if ($existing === null) {
                    $id = (string) Str::uuid();
                    if (! $dryRun) {
                        DB::table('vocabulary_terms')->insert([
                            'id' => $id,
                            'user_id' => $userId,
                            'term' => $importRow['term'],
                            'kind' => $importRow['kind'],
                            'aliases' => $importRow['aliases'],
                            'note' => $importRow['note'],
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]);
                    }
                    $created[] = $importRow['term'];
                    $byTermKey[$key] = (object) ['id' => $id, 'term' => $importRow['term'], 'aliases' => $importRow['aliases']];

                    continue;
                }

                $mergedAliases = $this->mergeAliases($existing->aliases, $importRow['aliases']);
                if (! $dryRun) {
                    DB::table('vocabulary_terms')->where('id', $existing->id)->update([
                        'aliases' => $mergedAliases,
                        'updated_at' => $now,
                    ]);
                }
                $merged[] = $existing->term;
                $existing->aliases = $mergedAliases;
                $byTermKey[$key] = $existing;
            }
        };

        if ($dryRun) {
            $apply();
        } else {
            DB::transaction($apply);
        }

        return response()->json([
            'ok' => true,
            'dryRun' => $dryRun,
            'created' => count($created),
            'merged' => count($merged),
            'diff' => ['created' => $created, 'merged' => $merged],
        ]);
    }

    /**
     * @return array{rows: array<int, array{term: string, kind: string, aliases: ?string, note: ?string}>, errors: array<int, string>}
     */
    private function parseCsvImport(string $content): array
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
        $unknown = array_diff($header, self::IMPORT_COLUMNS);
        if ($unknown !== []) {
            fclose($stream);

            return ['rows' => [], 'errors' => ['Unknown column(s): '.implode(', ', $unknown).'.']];
        }
        if (! in_array('term', $header, true)) {
            fclose($stream);

            return ['rows' => [], 'errors' => ['Missing required "term" column.']];
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
            [$row, $rowError] = $this->validateImportRow($assoc, $rowNumber);
            if ($rowError !== null) {
                $errors[] = $rowError;

                continue;
            }
            $rows[] = $row;
        }

        fclose($stream);

        return ['rows' => $rows, 'errors' => $errors];
    }

    /**
     * @return array{rows: array<int, array{term: string, kind: string, aliases: ?string, note: ?string}>, errors: array<int, string>}
     */
    private function parseJsonImport(string $content): array
    {
        try {
            $data = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return ['rows' => [], 'errors' => ['Invalid JSON file.']];
        }

        $list = is_array($data) && array_is_list($data) ? $data : ($data['terms'] ?? null);
        if (! is_array($list)) {
            return ['rows' => [], 'errors' => ['JSON file must contain an array of terms (or {"terms": [...]}).']];
        }

        $rows = [];
        $errors = [];

        foreach (array_values($list) as $index => $item) {
            $rowNumber = $index + 1;

            if (! is_array($item)) {
                $errors[] = "Row {$rowNumber}: expected an object.";

                continue;
            }

            $unknown = array_diff(array_keys($item), self::IMPORT_COLUMNS);
            if ($unknown !== []) {
                $errors[] = "Row {$rowNumber}: unknown field(s) ".implode(', ', $unknown).'.';

                continue;
            }

            [$row, $rowError] = $this->validateImportRow($item, $rowNumber);
            if ($rowError !== null) {
                $errors[] = $rowError;

                continue;
            }
            $rows[] = $row;
        }

        return ['rows' => $rows, 'errors' => $errors];
    }

    /**
     * @param  array<string, mixed>  $assoc
     * @return array{0: ?array{term: string, kind: string, aliases: ?string, note: ?string}, 1: ?string}
     */
    private function validateImportRow(array $assoc, int $rowNumber): array
    {
        $term = trim((string) ($assoc['term'] ?? ''));
        if ($term === '') {
            return [null, "Row {$rowNumber}: term is required."];
        }

        $kind = trim((string) ($assoc['kind'] ?? '')) ?: 'custom';
        if (! in_array($kind, self::KINDS, true)) {
            return [null, "Row {$rowNumber}: invalid kind \"{$kind}\"."];
        }

        $aliases = trim((string) ($assoc['aliases'] ?? ''));
        $note = trim((string) ($assoc['note'] ?? ''));

        return [[
            'term' => $term,
            'kind' => $kind,
            'aliases' => $aliases !== '' ? $aliases : null,
            'note' => $note !== '' ? $note : null,
        ], null];
    }

    /**
     * Union incoming synonyms into the existing alias list, de-duplicated
     * case-insensitively so a re-import never doubles up an alias already
     * present on the term.
     */
    private function mergeAliases(?string $existing, ?string $incoming): ?string
    {
        $merged = [];
        foreach ([...$this->splitAliases($existing), ...$this->splitAliases($incoming)] as $alias) {
            $merged[mb_strtolower($alias)] ??= $alias;
        }

        return $merged === [] ? null : implode(', ', array_values($merged));
    }

    /**
     * @return array<int, string>
     */
    private function splitAliases(?string $aliases): array
    {
        if ($aliases === null || trim($aliases) === '') {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(',', $aliases)), fn ($a): bool => $a !== ''));
    }

    private function csvLine(array $fields): string
    {
        $escaped = array_map(function ($field): string {
            $field = (string) $field;

            return preg_match('/[",\n]/', $field) === 1
                ? '"'.str_replace('"', '""', $field).'"'
                : $field;
        }, $fields);

        return implode(',', $escaped)."\n";
    }

    private function userId(Request $request): string
    {
        $user = $request->attributes->get('archive_user');

        return (string) $user?->getKey();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatTerm(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'term' => $row->term,
            'kind' => $row->kind,
            'aliases' => $row->aliases,
            'note' => $row->note,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
