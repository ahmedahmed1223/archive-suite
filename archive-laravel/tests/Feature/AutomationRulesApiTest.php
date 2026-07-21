<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

class AutomationRulesApiTest extends TestCase
{
    use RefreshDatabase, AuthenticatesArchiveRequests;

    public function test_it_creates_runs_and_deletes_automation_rules(): void
    {
        $this->seedRecords();

        $created = $this->postJson('/api/v1/automation/rules', [
            'name' => 'Review Riyadh videos',
            'trigger' => 'schedule.daily',
            'query' => 'riyadh',
            'type' => 'video',
            'tag' => 'city',
            'status' => 'draft',
            'action' => 'set-review',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('rule.name', 'Review Riyadh videos')
            ->assertJsonPath('rule.status', 'draft');

        $ruleId = $created->json('rule.id');
        $this->assertIsString($ruleId);

        $this->getJson('/api/v1/automation/rules', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'rules');

        $this->postJson('/api/v1/automation/rules/'.$ruleId.'/run', ['dryRun' => true], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.dryRun', true)
            ->assertJsonPath('run.matchedCount', 1)
            ->assertJsonPath('run.executedCount', 0);

        $this->postJson('/api/v1/automation/rules/'.$ruleId.'/run', ['dryRun' => false], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.dryRun', false)
            ->assertJsonPath('run.matchedCount', 1)
            ->assertJsonPath('run.executedCount', 1);

        $this->getJson('/api/v1/records/auto-1?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('record.workflowStatus', 'review');

        $this->deleteJson('/api/v1/automation/rules/'.$ruleId, [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('deleted', true);
    }

    public function test_runs_list_reports_pagination_beyond_limit(): void
    {
        $created = $this->postJson('/api/v1/automation/rules', [
            'name' => 'Paginated runs rule',
            'trigger' => 'schedule.daily',
            'action' => 'notify-admin',
        ], $this->authHeaders())->assertCreated();

        $ruleId = $created->json('rule.id');
        $this->assertIsString($ruleId);

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/v1/automation/rules/'.$ruleId.'/run', ['dryRun' => true], $this->authHeaders())
                ->assertCreated();
        }

        $this->getJson('/api/v1/automation/rules?limit=2', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(2, 'runs')
            ->assertJsonPath('pagination.total', 3)
            ->assertJsonPath('pagination.page', 1)
            ->assertJsonPath('pagination.limit', 2)
            ->assertJsonPath('pagination.hasMore', true);

        $this->getJson('/api/v1/automation/rules?limit=2&page=2', $this->authHeaders())
            ->assertOk()
            ->assertJsonCount(1, 'runs')
            ->assertJsonPath('pagination.page', 2)
            ->assertJsonPath('pagination.hasMore', false);
    }

    public function test_it_rejects_unsafe_or_missing_automation_requests(): void
    {
        $this->postJson('/api/v1/automation/rules', [
            'name' => 'Invalid',
            'trigger' => 'unknown',
            'action' => 'notify-admin',
        ], $this->authHeaders())->assertUnprocessable();

        $this->getJson('/api/v1/automation/rules')
            ->assertUnauthorized()
            ->assertJsonPath('ok', false);
    }

    /**
     * V1-758: fileExtension condition matches records whose fileName (set by
     * upload/ingest) ends in one of a comma-separated extension list, case-
     * insensitively, and leaves non-matching extensions and extensionless
     * records unmatched.
     */
    public function test_file_extension_condition_matches_only_imported_files_with_that_extension(): void
    {
        $this->seedFileRecords();

        $created = $this->postJson('/api/v1/automation/rules', [
            'name' => 'Tag imported PDFs',
            'trigger' => 'record.created',
            'fileExtension' => 'pdf,DOCX',
            'action' => 'add-tag',
        ], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('rule.fileExtension', 'pdf,DOCX');

        $ruleId = $created->json('rule.id');

        $this->postJson('/api/v1/automation/rules/'.$ruleId.'/run', ['dryRun' => true], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.matchedCount', 2);

        $run = $this->postJson('/api/v1/automation/rules/'.$ruleId.'/run', ['dryRun' => false], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.matchedCount', 2)
            ->assertJsonPath('run.executedCount', 2);

        $matchedIds = collect($run->json('run.sampleRecords'))->pluck('id')->all();
        $this->assertContains('file-pdf', $matchedIds);
        $this->assertContains('file-docx', $matchedIds);
        $this->assertNotContains('file-mp4', $matchedIds);
        $this->assertNotContains('file-none', $matchedIds);
    }

    public function test_file_extension_condition_combines_with_other_conditions(): void
    {
        $this->seedFileRecords();

        $created = $this->postJson('/api/v1/automation/rules', [
            'name' => 'Video files only',
            'trigger' => 'record.created',
            'type' => 'video',
            'fileExtension' => 'pdf',
            'action' => 'add-tag',
        ], $this->authHeaders())->assertCreated();

        $ruleId = $created->json('rule.id');

        // file-pdf is type "document", not "video" - the type condition
        // excludes it even though the extension matches.
        $this->postJson('/api/v1/automation/rules/'.$ruleId.'/run', ['dryRun' => true], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.matchedCount', 0);
    }

    public function test_no_file_extension_condition_matches_records_regardless_of_file_name(): void
    {
        $this->seedFileRecords();

        $created = $this->postJson('/api/v1/automation/rules', [
            'name' => 'All imported files',
            'trigger' => 'record.created',
            'action' => 'add-tag',
        ], $this->authHeaders())->assertCreated();

        $ruleId = $created->json('rule.id');

        $this->postJson('/api/v1/automation/rules/'.$ruleId.'/run', ['dryRun' => true], $this->authHeaders())
            ->assertCreated()
            ->assertJsonPath('run.matchedCount', 4);
    }

    private function seedRecords(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                [
                    'uid' => 'auto-1',
                    'id' => 'auto-1',
                    'title' => 'Riyadh archive interview',
                    'type' => 'video',
                    'tags' => ['city'],
                    'workflowStatus' => 'draft',
                ],
                [
                    'uid' => 'auto-2',
                    'id' => 'auto-2',
                    'title' => 'Jeddah archive interview',
                    'type' => 'video',
                    'tags' => ['city'],
                    'workflowStatus' => 'draft',
                ],
            ],
        ], $this->authHeaders())->assertOk();
    }

    private function seedFileRecords(): void
    {
        $this->postJson('/api/v1/records/bulk', [
            'store' => 'archive-items',
            'records' => [
                ['uid' => 'file-pdf', 'id' => 'file-pdf', 'title' => 'Report', 'type' => 'document', 'fileName' => 'annual-report.PDF'],
                ['uid' => 'file-docx', 'id' => 'file-docx', 'title' => 'Notes', 'type' => 'document', 'fileName' => 'meeting-notes.docx'],
                ['uid' => 'file-mp4', 'id' => 'file-mp4', 'title' => 'Clip', 'type' => 'video', 'fileName' => 'clip.mp4'],
                ['uid' => 'file-none', 'id' => 'file-none', 'title' => 'No file record'],
            ],
        ], $this->authHeaders())->assertOk();
    }
}
