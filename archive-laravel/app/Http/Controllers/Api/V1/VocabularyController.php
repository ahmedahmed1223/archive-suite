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
    private const BUILTIN_KINDS = [
        ['key' => 'type', 'label' => 'نوع محتوى', 'description' => 'أنواع المواد الأرشيفية', 'icon' => '🎬', 'order' => 10],
        ['key' => 'tag', 'label' => 'وسم', 'description' => 'وسوم الاستكشاف والتوصيف', 'icon' => '🏷️', 'order' => 20],
        ['key' => 'person', 'label' => 'شخصية', 'description' => 'أشخاص وشخصيات ورموز', 'icon' => '👤', 'order' => 30],
        ['key' => 'place', 'label' => 'مكان', 'description' => 'أماكن وبلدات ومواقع', 'icon' => '🗺️', 'order' => 40],
        ['key' => 'event', 'label' => 'حدث', 'description' => 'أحداث ومناسبات', 'icon' => '📅', 'order' => 50],
        ['key' => 'custom', 'label' => 'مصطلح عام', 'description' => 'مفاهيم ومصطلحات عامة', 'icon' => '📚', 'order' => 60],
    ];

    /** Columns accepted on export/import; anything else in a file is rejected. */
    private const IMPORT_COLUMNS = ['term', 'kind', 'aliases', 'note'];

    public function kinds(Request $request): JsonResponse
    {
        return response()->json(['ok' => true, 'kinds' => $this->kindDefinitions($this->userId($request))]);
    }

    public function replaceKinds(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'kinds' => ['present', 'array', 'max:50'],
            'kinds.*.key' => ['required', 'string', 'regex:/^[a-z][a-z0-9_-]{0,63}$/', 'distinct'],
            'kinds.*.label' => ['required', 'string', 'max:120'],
            'kinds.*.description' => ['nullable', 'string', 'max:500'],
            'kinds.*.icon' => ['nullable', 'string', 'max:16'],
            'kinds.*.order' => ['nullable', 'integer', 'min:0', 'max:10000'],
        ]);
        $userId = $this->userId($request);

        if (array_intersect(array_column($validated['kinds'], 'key'), $this->builtinKindKeys()) !== []) {
            return response()->json(ApiError::envelope('Built-in vocabulary kinds cannot be redefined.', 422), 422);
        }

        $configuredKeys = DB::table('vocabulary_kinds')->where('user_id', $userId)->pluck('key')->all();
        $removedKeys = array_values(array_diff($configuredKeys, array_column($validated['kinds'], 'key')));
        if ($removedKeys !== [] && DB::table('vocabulary_terms')
            ->where('user_id', $userId)
            ->whereIn('kind', $removedKeys)
            ->exists()) {
            return response()->json(ApiError::envelope('A vocabulary category used by a term cannot be removed.', 422), 422);
        }

        DB::transaction(function () use ($validated, $userId): void {
            DB::table('vocabulary_kinds')->where('user_id', $userId)->delete();
            $now = now();
            $rows = array_map(fn (array $kind): array => [
                'id' => (string) Str::uuid(),
                'user_id' => $userId,
                'key' => $kind['key'],
                'label' => trim($kind['label']),
                'description' => isset($kind['description']) ? trim((string) $kind['description']) ?: null : null,
                'icon' => isset($kind['icon']) ? trim((string) $kind['icon']) ?: null : null,
                'sort_order' => $kind['order'] ?? 1000,
                'created_at' => $now,
                'updated_at' => $now,
            ], $validated['kinds']);
            if ($rows !== []) {
                DB::table('vocabulary_kinds')->insert($rows);
            }
        });

        return $this->kinds($request);
    }

    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);

        $departmentId = $request->string('departmentId')->trim()->toString();
        $preferredTermIds = $departmentId === ''
            ? []
            : DB::table('department_vocabulary_preferences')
                ->where('user_id', $userId)
                ->where('department_id', $departmentId)
                ->orderBy('created_at')
                ->pluck('term_id')
                ->values()
                ->all();
        $terms = DB::table('vocabulary_terms')
            ->leftJoin('department_vocabulary_preferences as preferences', function ($join) use ($userId, $departmentId): void { $join->on('preferences.term_id','=','vocabulary_terms.id')->where('preferences.user_id','=',$userId)->where('preferences.department_id','=',$departmentId); })
            ->where('vocabulary_terms.user_id', $userId)
            ->orderByDesc('preferences.id')
            ->orderByDesc('vocabulary_terms.created_at')
            ->select('vocabulary_terms.*')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatTerm($row))
            ->values();

        return response()->json(['ok' => true, 'terms' => $terms, 'preferredTermIds' => $preferredTermIds]);
    }

    public function replaceDepartmentPreferences(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'departmentId' => ['required', 'string', 'min:1', 'max:100'],
            'termIds' => ['present', 'array', 'max:200'],
            'termIds.*' => ['string', 'max:100', 'distinct'],
        ]);
        $userId = $this->userId($request);

        if (DB::table('vocabulary_terms')->where('user_id', $userId)->whereIn('id', $validated['termIds'])->count() !== count($validated['termIds'])) {
            return response()->json(ApiError::envelope('Vocabulary term not found.', 422), 422);
        }

        DB::transaction(function () use ($validated, $userId): void {
            DB::table('department_vocabulary_preferences')
                ->where('user_id', $userId)
                ->where('department_id', $validated['departmentId'])
                ->delete();

            $now = now();
            $rows = array_map(fn (string $termId): array => [
                'id' => (string) Str::uuid(),
                'user_id' => $userId,
                'department_id' => $validated['departmentId'],
                'term_id' => $termId,
                'created_at' => $now,
                'updated_at' => $now,
            ], $validated['termIds']);

            if ($rows !== []) {
                DB::table('department_vocabulary_preferences')->insert($rows);
            }
        });

        return $this->index($request);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'term' => ['required', 'string', 'max:200'],
            'kind' => ['nullable', 'string', 'max:64'],
            'aliases' => ['nullable', 'string', 'max:500'],
            'canonicalTermId' => ['nullable', 'string', 'max:100'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $userId = $this->userId($request);
        $kind = $validated['kind'] ?? 'custom';
        if (! $this->isAllowedKind($userId, $kind)) {
            return response()->json(ApiError::envelope('Vocabulary kind not found.', 422), 422);
        }
        $canonicalTermId = $validated['canonicalTermId'] ?? null;
        if ($canonicalTermId !== null && ! DB::table('vocabulary_terms')
            ->where('id', $canonicalTermId)
            ->where('user_id', $userId)
            ->exists()) {
            return response()->json(ApiError::envelope('Canonical vocabulary term not found.', 422), 422);
        }
        $now = now();
        $id = (string) Str::uuid();

        DB::table('vocabulary_terms')->insert([
            'id' => $id,
            'user_id' => $userId,
            'term' => trim((string) $validated['term']),
            'kind' => $kind,
            'aliases' => $validated['aliases'] ?? null,
            'canonical_term_id' => $canonicalTermId,
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

        $userId = $this->userId($request);
        $parsed = $request->string('format')->toString() === 'csv'
            ? $this->parseCsvImport($content, $this->kindKeys($userId))
            : $this->parseJsonImport($content, $this->kindKeys($userId));

        if ($parsed['errors'] !== []) {
            return response()->json([
                ...ApiError::envelope('Import file contains invalid rows.', 422, 'validation_failed'),
                'rowErrors' => $parsed['errors'],
            ], 422);
        }

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
    private function parseCsvImport(string $content, array $allowedKinds): array
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
            [$row, $rowError] = $this->validateImportRow($assoc, $rowNumber, $allowedKinds);
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
    private function parseJsonImport(string $content, array $allowedKinds): array
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

            [$row, $rowError] = $this->validateImportRow($item, $rowNumber, $allowedKinds);
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
    private function validateImportRow(array $assoc, int $rowNumber, array $allowedKinds): array
    {
        $term = trim((string) ($assoc['term'] ?? ''));
        if ($term === '') {
            return [null, "Row {$rowNumber}: term is required."];
        }

        $kind = trim((string) ($assoc['kind'] ?? '')) ?: 'custom';
        if (! in_array($kind, $allowedKinds, true)) {
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

    /** @return array<int, string> */
    private function builtinKindKeys(): array
    {
        return array_column(self::BUILTIN_KINDS, 'key');
    }

    /** @return array<int, string> */
    private function kindKeys(string $userId): array
    {
        return [
            ...$this->builtinKindKeys(),
            ...DB::table('vocabulary_kinds')->where('user_id', $userId)->pluck('key')->all(),
        ];
    }

    private function isAllowedKind(string $userId, string $kind): bool
    {
        return in_array($kind, $this->kindKeys($userId), true);
    }

    /** @return array<int, array{key: string, label: string, description: ?string, icon: ?string, order: int, builtIn: bool}> */
    private function kindDefinitions(string $userId): array
    {
        $custom = DB::table('vocabulary_kinds')
            ->where('user_id', $userId)
            ->orderBy('sort_order')
            ->orderBy('key')
            ->get()
            ->map(fn (stdClass $kind): array => [
                'key' => $kind->key,
                'label' => $kind->label,
                'description' => $kind->description,
                'icon' => $kind->icon,
                'order' => (int) $kind->sort_order,
                'builtIn' => false,
            ])
            ->all();
        $builtIns = array_map(fn (array $kind): array => [...$kind, 'builtIn' => true], self::BUILTIN_KINDS);

        return [...$builtIns, ...$custom];
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
            'canonicalTermId' => $row->canonical_term_id,
            'note' => $row->note,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
