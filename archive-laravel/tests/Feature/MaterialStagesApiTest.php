<?php

namespace Tests\Feature;

use App\Models\MediaJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AuthenticatesArchiveRequests;
use Tests\TestCase;

/**
 * The stage derivation had unit tests that passed while the endpoint answered
 * 500: they called deriveStage() with hand-built objects, so nothing ever
 * exercised the query that feeds it. These cases go through HTTP instead.
 */
class MaterialStagesApiTest extends TestCase
{
    use AuthenticatesArchiveRequests, RefreshDatabase;

    private function record(string $uid, array $data = []): void
    {
        DB::table('storage_rows')->insert([
            'store' => 'archive-items',
            'uid' => $uid,
            'data' => json_encode([
                'uid' => $uid,
                'title' => "Material {$uid}",
                'descriptorCompletion' => ['status' => 'green'],
                'createdAt' => now()->subDays(30)->toIso8601String(),
                'updatedAt' => now()->subDays(30)->toIso8601String(),
                ...$data,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now()->subDays(30),
            'updated_at' => now()->subDays(30),
        ]);
    }

    private function failedJob(string $recordUid, string $operation): void
    {
        MediaJob::query()->create([
            'id' => (string) Str::uuid(),
            'record_id' => $recordUid,
            'created_by' => null,
            'operation' => $operation,
            'status' => 'failed',
            'queue' => 'default',
            'executor' => 'fake',
            'contract_version' => 1,
            'error' => 'boom',
            'queued_at' => now(),
        ]);
    }

    private function rights(string $itemId): void
    {
        DB::table('rights_records')->insert([
            'id' => 'rr-'.$itemId,
            'item_id' => $itemId,
            'rights_holder' => 'Holder',
            'license_type' => 'OWNED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_the_stage_inbox_answers_instead_of_failing(): void
    {
        $this->record('m-ready');
        $this->rights('m-ready');

        $this->getJson('/api/v1/materials/inbox?store=archive-items', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('records.0.uid', 'm-ready')
            ->assertJsonPath('records.0.stage', 'ready_for_approval');
    }

    public function test_each_record_lands_in_the_stage_its_own_data_puts_it_in(): void
    {
        // Every one of these used to derive from three empty values, so they
        // all collapsed into the same stage regardless of their state.
        $this->record('m-rights-missing');

        $this->record('m-tech');
        $this->rights('m-tech');
        $this->failedJob('m-tech', 'media_qc');

        $this->record('m-processing');
        $this->rights('m-processing');
        $this->failedJob('m-processing', 'transcode');

        $this->record('m-incomplete', ['descriptorCompletion' => ['status' => 'red']]);
        $this->rights('m-incomplete');

        $stages = collect($this->getJson('/api/v1/materials/inbox?store=archive-items', $this->authHeaders())->assertOk()->json('records'))
            ->pluck('stage', 'uid');

        $this->assertSame('missing_rights', $stages['m-rights-missing']);
        $this->assertSame('tech_check_failed', $stages['m-tech']);
        // A failed transcode is not a failed technical check; the stage list
        // carried processing_failed but nothing could ever reach it.
        $this->assertSame('processing_failed', $stages['m-processing']);
        $this->assertSame('incomplete_description', $stages['m-incomplete']);
    }

    public function test_filtering_by_stage_returns_only_that_stage(): void
    {
        $this->record('m-one');
        $this->record('m-two');
        $this->rights('m-two');

        $response = $this->getJson('/api/v1/materials/inbox?store=archive-items&stage=missing_rights', $this->authHeaders())->assertOk();

        $this->assertSame(['m-one'], array_column($response->json('records'), 'uid'));
        // Counts stay whole-store so the stage chips do not change with the filter.
        $this->assertSame(1, $response->json('stageCounts.missing_rights'));
        $this->assertSame(1, $response->json('stageCounts.ready_for_approval'));
    }
}
