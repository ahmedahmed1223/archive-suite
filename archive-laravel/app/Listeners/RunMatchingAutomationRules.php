<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\RecordChanged;
use App\Services\Automation\AutomationRuleRunner;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use JsonException;
use stdClass;

/**
 * V1-758B: event-driven counterpart to the manual "run rule" endpoint
 * (AutomationRulesController::run). Reacts to RecordChanged (dispatched only
 * from RecordsController::bulk()) and runs every enabled rule whose trigger
 * matches record.created/record.updated against that single changed record.
 *
 * Multi-tenancy note: automation_rules rows are user-owned (user_id), but a
 * record change in storage_rows isn't owned by any one rule's user - the
 * archive store is shared. Event-driven execution deliberately runs ALL
 * enabled rules matching the trigger, system-wide, regardless of which user
 * created the rule or which user wrote the record. This differs from the
 * manual run() endpoint (which is scoped to the requesting user's own
 * rules) but is intentional here: the archive is a shared resource and any
 * enabled rule that matches should fire when the archive changes.
 */
class RunMatchingAutomationRules
{
    public function __construct(private readonly AutomationRuleRunner $runner)
    {
    }

    /**
     * @throws JsonException
     */
    public function handle(RecordChanged $event): void
    {
        if (! config('automation.event_driven_enabled')) {
            return;
        }

        $trigger = $event->wasCreated ? 'record.created' : 'record.updated';

        $rules = DB::table('automation_rules')
            ->where('enabled', true)
            ->where('trigger', $trigger)
            ->get();

        foreach ($rules as $rule) {
            $this->runRuleAgainstRecord($rule, $event->record);
        }
    }

    /**
     * @param array<string, mixed> $record
     *
     * @throws JsonException
     */
    private function runRuleAgainstRecord(stdClass $rule, array $record): void
    {
        $conditions = $this->runner->decodeJsonObject($rule->conditions);
        if (! $this->runner->recordMatches($record, $conditions)) {
            return;
        }

        $result = $this->runner->runAgainstRecords($rule, [$record], dryRun: false);
        $runId = (string) Str::uuid();
        $now = now();

        // Auditable exactly like the manual run() endpoint: one
        // automation_rule_runs row per execution.
        DB::table('automation_rule_runs')->insert([
            'id' => $runId,
            'rule_id' => $rule->id,
            'user_id' => $rule->user_id,
            'status' => 'completed',
            'dry_run' => false,
            'matched_count' => 1,
            'executed_count' => $result['executedCount'],
            'message' => $result['message'],
            'sample_records' => json_encode([[
                'id' => (string) ($record['id'] ?? $record['uid'] ?? ''),
                'title' => (string) ($record['title'] ?? ''),
            ]], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('automation_rules')
            ->where('id', $rule->id)
            ->update([
                'last_run_at' => $now,
                'updated_at' => $now,
            ]);
    }
}
