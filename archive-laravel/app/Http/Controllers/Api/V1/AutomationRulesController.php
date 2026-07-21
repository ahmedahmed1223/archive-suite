<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Automation\AutomationRuleRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use JsonException;
use stdClass;

class AutomationRulesController extends Controller
{
    private const TRIGGERS = [
        'record.created',
        'record.updated',
        'media.failed',
        'schedule.daily',
    ];

    private const ACTIONS = [
        'add-tag',
        'set-review',
        'notify-admin',
        'create-inbox-item',
    ];

    public function __construct(private readonly AutomationRuleRunner $runner)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $limit = (int) ($validated['limit'] ?? 25);
        $page = (int) ($validated['page'] ?? 1);
        $userId = $this->userId($request);

        $rules = DB::table('automation_rules')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatRule($row))
            ->values();

        // V1-304B: the runs list was silently capped at 25; paginate it with
        // the same envelope shape as the V1-304A endpoints.
        $paginated = DB::table('automation_rule_runs')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->paginate($limit, ['*'], 'page', $page);

        $runs = collect($paginated->items())
            ->map(fn (stdClass $row): array => $this->formatRun($row))
            ->values();

        return response()->json([
            'ok' => true,
            'rules' => $rules,
            'runs' => $runs,
            'pagination' => [
                'total' => $paginated->total(),
                'page' => $paginated->currentPage(),
                'limit' => $limit,
                'hasMore' => $paginated->hasMorePages(),
            ],
        ]);
    }

    /**
     * @throws JsonException
     */
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate($this->ruleValidationRules(requireName: true));
        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('automation_rules')->insert([
            'id' => $id,
            'user_id' => $userId,
            'name' => trim((string) $validated['name']),
            'trigger' => $validated['trigger'],
            'conditions' => json_encode($this->conditions($validated), JSON_THROW_ON_ERROR),
            'action' => $validated['action'],
            'enabled' => (bool) ($validated['enabled'] ?? true),
            'last_run_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $rule = DB::table('automation_rules')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'rule' => $this->formatRule($rule),
        ], 201);
    }

    /**
     * @throws JsonException
     */
    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $userId = $this->userId($request);
        $rule = DB::table('automation_rules')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (! $rule instanceof stdClass) {
            return $this->notFound();
        }

        $validated = $request->validate($this->ruleValidationRules(requireName: false));
        $currentConditions = $this->decodeJsonObject($rule->conditions);
        $nextConditions = array_replace($currentConditions, $this->conditions($validated, includeMissing: false));

        $updates = [
            'conditions' => json_encode($nextConditions, JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ];

        foreach (['name', 'trigger', 'action', 'enabled'] as $field) {
            if (array_key_exists($field, $validated)) {
                $updates[$field] = $field === 'name' ? trim((string) $validated[$field]) : $validated[$field];
            }
        }

        DB::table('automation_rules')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->update($updates);

        $updated = DB::table('automation_rules')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'rule' => $this->formatRule($updated),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $deleted = DB::table('automation_rules')
            ->where('id', $id)
            ->where('user_id', $this->userId($request))
            ->delete();

        if ($deleted < 1) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * @throws JsonException
     */
    public function run(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'dryRun' => ['nullable', 'boolean'],
        ]);

        $userId = $this->userId($request);
        $rule = DB::table('automation_rules')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        if (! $rule instanceof stdClass) {
            return $this->notFound();
        }

        $dryRun = (bool) ($validated['dryRun'] ?? true);
        if (! $dryRun && ! (bool) $rule->enabled) {
            return response()->json([
                'ok' => false,
                'error' => 'Disabled automation rules can only be dry-run.',
                'code' => 'rule_disabled',
            ], 409);
        }

        $records = $this->runner->matchingRecords($this->decodeJsonObject($rule->conditions));
        $result = $this->runner->runAgainstRecords($rule, $records, $dryRun);
        $executedCount = $result['executedCount'];
        $runId = (string) Str::uuid();
        $now = now();
        $message = $result['message'];

        DB::table('automation_rule_runs')->insert([
            'id' => $runId,
            'rule_id' => $rule->id,
            'user_id' => $userId,
            'status' => 'completed',
            'dry_run' => $dryRun,
            'matched_count' => count($records),
            'executed_count' => $executedCount,
            'message' => $message,
            'sample_records' => json_encode(array_slice(array_map(fn (array $record): array => [
                'id' => (string) ($record['id'] ?? $record['uid'] ?? ''),
                'title' => (string) ($record['title'] ?? ''),
            ], $records), 0, 8), JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('automation_rules')
            ->where('id', $rule->id)
            ->update([
                'last_run_at' => $now,
                'updated_at' => $now,
            ]);

        $run = DB::table('automation_rule_runs')->where('id', $runId)->first();

        return response()->json([
            'ok' => true,
            'run' => $this->formatRun($run),
        ], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function ruleValidationRules(bool $requireName): array
    {
        return [
            'name' => [$requireName ? 'required' : 'sometimes', 'string', 'max:200'],
            'trigger' => [$requireName ? 'required' : 'sometimes', 'string', Rule::in(self::TRIGGERS)],
            'query' => ['nullable', 'string', 'max:500'],
            'type' => ['nullable', 'string', 'max:100'],
            'tag' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:100'],
            // V1-758: comma-separated extensions (e.g. "pdf,docx"), matched
            // against the imported file's name - set by UploadFinalizer/
            // IngestScanner on every record created from an uploaded/ingested
            // file. Not full content inspection (no OCR/text-extraction
            // pipeline feeds automation matching yet) and there is no
            // event-driven auto-trigger on import either - rules still only
            // execute via the existing manual/scheduled run() endpoint.
            'fileExtension' => ['nullable', 'string', 'max:200'],
            'action' => [$requireName ? 'required' : 'sometimes', 'string', Rule::in(self::ACTIONS)],
            'enabled' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param array<string, mixed> $validated
     * @return array<string, string>
     */
    private function conditions(array $validated, bool $includeMissing = true): array
    {
        $conditions = [];
        foreach (['query', 'type', 'tag', 'status', 'fileExtension'] as $field) {
            if (array_key_exists($field, $validated)) {
                $conditions[$field] = trim((string) ($validated[$field] ?? ''));
            } elseif ($includeMissing) {
                $conditions[$field] = '';
            }
        }

        return $conditions;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRule(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        $conditions = $this->decodeJsonObject($row->conditions);

        return [
            'id' => $row->id,
            'name' => $row->name,
            'trigger' => $row->trigger,
            'query' => $conditions['query'] ?? '',
            'type' => $conditions['type'] ?? '',
            'tag' => $conditions['tag'] ?? '',
            'status' => $conditions['status'] ?? '',
            'fileExtension' => $conditions['fileExtension'] ?? '',
            'action' => $row->action,
            'enabled' => (bool) $row->enabled,
            'lastRunAt' => $row->last_run_at,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRun(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'ruleId' => $row->rule_id,
            'status' => $row->status,
            'dryRun' => (bool) $row->dry_run,
            'matchedCount' => (int) $row->matched_count,
            'executedCount' => (int) $row->executed_count,
            'message' => $row->message,
            'sampleRecords' => $this->decodeJsonArray($row->sample_records),
            'createdAt' => $row->created_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonObject(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @return array<int, mixed>
     */
    private function decodeJsonArray(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? array_values($decoded) : [];
    }

    private function userId(Request $request): string
    {
        $user = $request->attributes->get('archive_user');

        return (string) $user?->getKey();
    }

    private function notFound(): JsonResponse
    {
        return response()->json([
            'ok' => false,
            'error' => 'Automation rule not found.',
            'code' => 'not_found',
        ], 404);
    }
}
