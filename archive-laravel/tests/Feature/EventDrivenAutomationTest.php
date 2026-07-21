<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Events\RecordChanged;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * V1-758B: event-driven automation triggers. RecordsController::bulk()
 * dispatches RecordChanged for every archive-items write; the
 * RunMatchingAutomationRules listener reacts to it and executes any
 * enabled rule whose trigger matches, reusing AutomationRuleRunner (the
 * same code path the manual /automation/rules/{id}/run endpoint uses).
 */
class EventDrivenAutomationTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_bulk_dispatches_record_changed_for_archive_store(): void
    {
        Event::fake([RecordChanged::class]);

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'evt-1', 'id' => 'evt-1', 'title' => 'Event dispatch check', 'type' => 'video'],
            ],
        ], $this->authHeaders())->assertOk();

        Event::assertDispatched(RecordChanged::class, fn (RecordChanged $event): bool => $event->uid === 'evt-1'
            && $event->store === 'archive-items'
            && $event->wasCreated === true);
    }

    public function test_creating_a_new_record_runs_a_matching_enabled_record_created_rule(): void
    {
        $ruleId = $this->makeRule('record.created', 'add-tag', enabled: true, conditions: ['type' => 'video']);

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'new-1', 'id' => 'new-1', 'title' => 'New archive clip', 'type' => 'video'],
            ],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/new-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.tags', ['automation']);

        $run = DB::table('automation_rule_runs')->where('rule_id', $ruleId)->first();
        $this->assertNotNull($run);
        $this->assertSame(1, (int) $run->executed_count);
        $this->assertFalse((bool) $run->dry_run);

        $rule = DB::table('automation_rules')->where('id', $ruleId)->first();
        $this->assertNotNull($rule->last_run_at);
    }

    public function test_disabled_rule_does_not_run_on_record_created(): void
    {
        $ruleId = $this->makeRule('record.created', 'add-tag', enabled: false, conditions: ['type' => 'video']);

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'disabled-1', 'id' => 'disabled-1', 'title' => 'Should not be tagged', 'type' => 'video', 'tags' => []],
            ],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/disabled-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.tags', []);

        $this->assertSame(0, DB::table('automation_rule_runs')->where('rule_id', $ruleId)->count());
    }

    public function test_record_not_matching_conditions_does_not_get_the_action(): void
    {
        $ruleId = $this->makeRule('record.created', 'add-tag', enabled: true, conditions: ['type' => 'video']);

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'doc-1', 'id' => 'doc-1', 'title' => 'A PDF, not a video', 'type' => 'document', 'tags' => []],
            ],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/doc-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.tags', []);

        $this->assertSame(0, DB::table('automation_rule_runs')->where('rule_id', $ruleId)->count());
    }

    public function test_updating_an_existing_record_fires_record_updated_trigger(): void
    {
        // Seed the record first, with no rules yet enabled - this is a plain
        // create and must not run the record.updated rule created below.
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'upd-1', 'id' => 'upd-1', 'title' => 'Original title', 'type' => 'video'],
            ],
        ], $this->authHeaders())->assertOk();

        $ruleId = $this->makeRule('record.updated', 'set-review', enabled: true, conditions: ['type' => 'video']);

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'upd-1', 'id' => 'upd-1', 'title' => 'Original title', 'type' => 'video'],
            ],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/upd-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.workflowStatus', 'review');

        $this->assertSame(1, DB::table('automation_rule_runs')->where('rule_id', $ruleId)->count());
    }

    public function test_event_driven_flag_disabled_prevents_any_rule_from_running(): void
    {
        config(['automation.event_driven_enabled' => false]);

        $ruleId = $this->makeRule('record.created', 'add-tag', enabled: true, conditions: ['type' => 'video']);

        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'flagged-off-1', 'id' => 'flagged-off-1', 'title' => 'Flag off', 'type' => 'video', 'tags' => []],
            ],
        ], $this->authHeaders())->assertOk();

        $this->getJson('/api/v1/records/flagged-off-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.tags', []);

        $this->assertSame(0, DB::table('automation_rule_runs')->where('rule_id', $ruleId)->count());
    }

    /**
     * @param array<string, string> $conditions
     */
    private function makeRule(string $trigger, string $action, bool $enabled, array $conditions): string
    {
        $id = (string) Str::uuid();
        $now = now();

        DB::table('automation_rules')->insert([
            'id' => $id,
            'user_id' => 'test-user',
            'name' => 'Test rule '.$id,
            'trigger' => $trigger,
            'conditions' => json_encode($conditions + ['query' => '', 'type' => '', 'tag' => '', 'status' => '', 'fileExtension' => ''], JSON_THROW_ON_ERROR),
            'action' => $action,
            'enabled' => $enabled,
            'last_run_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return $id;
    }
}
