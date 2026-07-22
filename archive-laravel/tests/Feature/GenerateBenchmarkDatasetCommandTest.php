<?php

namespace Tests\Feature;

use App\Console\Commands\GenerateBenchmarkDatasetCommand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GenerateBenchmarkDatasetCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    public function test_generates_records_and_files_under_the_synthetic_store(): void
    {
        $this->artisan('archive:generate-benchmark-dataset', [
            '--seed' => 7,
            '--records' => 5,
            '--files' => 3,
            '--files-total-size' => 300,
            '--disk' => 'local',
        ])->assertExitCode(0);

        $this->assertSame(5, DB::table('storage_rows')->where('store', GenerateBenchmarkDatasetCommand::STORE)->count());
        $this->assertSame(3, DB::table('record_attachments')->where('record_store', GenerateBenchmarkDatasetCommand::STORE)->count());

        $record = DB::table('storage_rows')->where('store', GenerateBenchmarkDatasetCommand::STORE)->first();
        $data = json_decode($record->data, true);
        $this->assertStringStartsWith('[BENCHMARK-SYNTHETIC]', $data['title']);
    }

    public function test_same_seed_is_deterministic(): void
    {
        $this->artisan('archive:generate-benchmark-dataset', [
            '--seed' => 11,
            '--records' => 3,
            '--files' => 2,
            '--files-total-size' => 200,
            '--disk' => 'local',
        ])->assertExitCode(0);

        $firstRun = DB::table('storage_rows')->where('store', GenerateBenchmarkDatasetCommand::STORE)
            ->orderBy('uid')->pluck('data')->all();
        $firstChecksums = DB::table('record_attachments')->where('record_store', GenerateBenchmarkDatasetCommand::STORE)
            ->orderBy('path')->pluck('checksum_sha256')->all();

        $this->artisan('archive:generate-benchmark-dataset', [
            '--seed' => 11,
            '--records' => 3,
            '--files' => 2,
            '--files-total-size' => 200,
            '--disk' => 'local',
        ])->assertExitCode(0);

        $secondRun = DB::table('storage_rows')->where('store', GenerateBenchmarkDatasetCommand::STORE)
            ->orderBy('uid')->pluck('data')->all();
        $secondChecksums = DB::table('record_attachments')->where('record_store', GenerateBenchmarkDatasetCommand::STORE)
            ->orderBy('path')->pluck('checksum_sha256')->all();

        $this->assertSame($firstRun, $secondRun);
        $this->assertSame($firstChecksums, $secondChecksums);
    }

    public function test_json_flag_prints_a_summary(): void
    {
        $this->artisan('archive:generate-benchmark-dataset', [
            '--seed' => 1,
            '--records' => 1,
            '--files' => 0,
            '--files-total-size' => 0,
            '--json' => true,
        ])->assertExitCode(0)
            ->expectsOutputToContain('"store":"'.GenerateBenchmarkDatasetCommand::STORE.'"');
    }
}
