<?php

declare(strict_types=1);

namespace App\Services\Automation;

use App\Support\StorageRowPayload;
use Illuminate\Support\Facades\DB;
use JsonException;
use stdClass;

/**
 * V1-758B: single code path for matching records against an automation
 * rule's conditions and executing the rule's action. Shared by the manual
 * "run rule" HTTP endpoint (AutomationRulesController::run) and the
 * event-driven listener (RunMatchingAutomationRules) so both stay in sync
 * with byte-for-byte identical matching/execution behavior.
 *
 * ponytail: this service only ever WRITES to storage_rows directly via
 * DB::table()->updateOrInsert() - it never dispatches RecordChanged itself.
 * That is the loop-prevention boundary: RecordChanged is only ever
 * dispatched from RecordsController::bulk() (the HTTP write path), so an
 * add-tag/set-review action executed here (whether from the manual run()
 * endpoint or from the event listener) can never re-trigger itself.
 */
class AutomationRuleRunner
{
    public const ARCHIVE_STORE = 'archive-items';

    /**
     * @param array<string, mixed> $conditions
     * @return array<int, array<string, mixed>>
     */
    public function matchingRecords(array $conditions): array
    {
        return DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (stdClass $row): array => StorageRowPayload::format($row))
            ->filter(fn (array $record): bool => $this->recordMatches($record, $conditions))
            ->values()
            ->all();
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, mixed> $conditions
     */
    public function recordMatches(array $record, array $conditions): bool
    {
        $query = $this->normalize((string) ($conditions['query'] ?? ''));
        if ($query !== '') {
            $text = $this->normalize(implode(' ', [
                $record['title'] ?? '',
                $record['description'] ?? '',
                $record['type'] ?? '',
                $record['subtype'] ?? '',
                implode(' ', (array) ($record['tags'] ?? [])),
            ]));

            if (! str_contains($text, $query)) {
                return false;
            }
        }

        foreach (['type', 'status'] as $field) {
            $value = trim((string) ($conditions[$field] ?? ''));
            $recordValue = $field === 'status'
                ? (string) ($record['workflowStatus'] ?? $record['status'] ?? 'draft')
                : (string) ($record[$field] ?? '');

            if ($value !== '' && $value !== 'all' && $recordValue !== $value) {
                return false;
            }
        }

        $tag = $this->normalize((string) ($conditions['tag'] ?? ''));
        if ($tag !== '' && $tag !== 'all') {
            $tags = array_map(fn (mixed $value): string => $this->normalize((string) $value), (array) ($record['tags'] ?? []));
            if (! in_array($tag, $tags, true)) {
                return false;
            }
        }

        $fileExtensionCondition = $this->normalize((string) ($conditions['fileExtension'] ?? ''));
        if ($fileExtensionCondition !== '') {
            $allowed = array_filter(array_map('trim', explode(',', $fileExtensionCondition)));
            $recordExtension = $this->normalize((string) pathinfo((string) ($record['fileName'] ?? ''), PATHINFO_EXTENSION));
            if ($recordExtension === '' || ! in_array($recordExtension, $allowed, true)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Runs a rule's action (or a dry-run no-op) against an explicit set of
     * already-matched records. Used by the manual run() endpoint (records
     * come from matchingRecords()) and the event listener (a single-record
     * array from a RecordChanged event).
     *
     * @param array<int, array<string, mixed>> $records
     * @return array{executedCount: int, message: string}
     *
     * @throws JsonException
     */
    public function runAgainstRecords(stdClass $rule, array $records, bool $dryRun): array
    {
        $executedCount = $dryRun ? 0 : $this->executeAction($rule, $records);
        $message = $dryRun
            ? 'Dry-run completed without mutating records.'
            : $this->actionMessage((string) $rule->action, $executedCount);

        return ['executedCount' => $executedCount, 'message' => $message];
    }

    /**
     * @param array<int, array<string, mixed>> $records
     *
     * @throws JsonException
     */
    public function executeAction(stdClass $rule, array $records): int
    {
        $count = 0;

        foreach ($records as $record) {
            $uid = (string) ($record['uid'] ?? $record['id'] ?? '');
            if ($uid === '') {
                continue;
            }

            if ($rule->action === 'set-review') {
                $record['workflowStatus'] = 'review';
                $this->upsertRecord($uid, $record);
                $count++;
                continue;
            }

            if ($rule->action === 'add-tag') {
                $record['tags'] = array_values(array_unique([...(array) ($record['tags'] ?? []), 'automation']));
                $this->upsertRecord($uid, $record);
                $count++;
                continue;
            }

            if ($rule->action === 'create-inbox-item') {
                DB::table('storage_rows')->updateOrInsert(
                    ['store' => 'inbox-items', 'uid' => 'automation-'.$rule->id.'-'.$uid],
                    [
                        'data' => json_encode([
                            'uid' => 'automation-'.$rule->id.'-'.$uid,
                            'id' => 'automation-'.$rule->id.'-'.$uid,
                            'title' => 'Automation follow-up: '.(string) ($record['title'] ?? $uid),
                            'sourceRecordId' => $uid,
                            'ruleId' => $rule->id,
                            'status' => 'open',
                        ], JSON_THROW_ON_ERROR),
                        'updated_at' => now(),
                        'created_at' => now(),
                    ],
                );
                $count++;
                continue;
            }

            if ($rule->action === 'notify-admin') {
                $count++;
            }
        }

        return $count;
    }

    public function actionMessage(string $action, int $count): string
    {
        return match ($action) {
            'add-tag' => "Added automation tag to {$count} records.",
            'set-review' => "Moved {$count} records to review.",
            'create-inbox-item' => "Created {$count} inbox follow-up items.",
            default => "Queued {$count} admin notifications in the execution log.",
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function decodeJsonObject(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @param array<string, mixed> $record
     *
     * @throws JsonException
     */
    private function upsertRecord(string $uid, array $record): void
    {
        // ponytail: writes directly here (not through RecordsController::bulk),
        // so no RecordChanged event fires for this write - see class docblock.
        DB::table('storage_rows')->updateOrInsert(
            ['store' => self::ARCHIVE_STORE, 'uid' => $uid],
            [
                'data' => json_encode(['uid' => $uid] + $record, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ],
        );
    }

    private function normalize(string $value): string
    {
        return mb_strtolower(trim($value));
    }
}
