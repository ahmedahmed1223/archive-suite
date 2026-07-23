<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * V1-208H: Setup's CLI has no HTTP session, so it drives BackupService via
 * archive:backup-run / -list / -verify / -restore instead of
 * BackupsController. Covers the same guarantees BackupsApiTest.php covers
 * over HTTP (checksum gate before any restore, no destructive action
 * without explicit confirmation), plus --json being a single parsable line.
 */
class BackupCommandsTest extends TestCase
{
    use RefreshDatabase;

    private string $backupDir;

    private string $fileRoot;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backupDir = storage_path('framework/testing/backup-commands-'.uniqid());
        config(['archive.backup_path' => $this->backupDir]);

        // V1-121's dumpFiles() walks the real archive.file_root recursively
        // and loads every file's full content into memory. Left pointed at
        // the shared storage_path('app/private') — which every upload/media/
        // ingest test writes into and none of them clean up — a long test
        // session accumulates enough real files there to exhaust PHP's
        // memory_limit on an unrelated backup-mechanics test. This class
        // never asserts on file/manifest content, only table backup/restore,
        // so an isolated empty directory is both correct and immune to
        // whatever the rest of the suite has left lying around.
        $this->fileRoot = storage_path('framework/testing/backup-commands-files-'.uniqid());
        config(['archive.file_root' => $this->fileRoot]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backupDir);
        File::deleteDirectory($this->fileRoot);

        parent::tearDown();
    }

    public function test_backup_run_creates_a_backup_and_prints_a_single_json_line(): void
    {
        $this->seedRecords(['a-001' => 'First']);

        $exitCode = Artisan::call('archive:backup-run', ['--json' => true]);
        $payload = $this->decodeSingleJsonLine(Artisan::output());

        $this->assertSame(0, $exitCode);
        $this->assertTrue($payload['ok']);
        $this->assertSame('BACKUP_CREATED', $payload['code']);
        $this->assertMatchesRegularExpression('/^backup-[A-Za-z0-9._-]+\.json\.gz$/', $payload['details']['backup']['name']);
        $this->assertFileExists($this->backupDir.DIRECTORY_SEPARATOR.$payload['details']['backup']['name']);
    }

    public function test_backup_list_reports_backups_via_json(): void
    {
        $this->seedRecords(['a-001' => 'First']);
        Artisan::call('archive:backup-run', ['--json' => true]);
        $name = $this->decodeSingleJsonLine(Artisan::output())['details']['backup']['name'];

        $exitCode = Artisan::call('archive:backup-list', ['--json' => true]);
        $payload = $this->decodeSingleJsonLine(Artisan::output());

        $this->assertSame(0, $exitCode);
        $this->assertTrue($payload['ok']);
        $this->assertCount(1, $payload['details']['backups']);
        $this->assertSame($name, $payload['details']['backups'][0]['name']);
    }

    public function test_backup_verify_reports_a_healthy_backup_as_verified(): void
    {
        $this->seedRecords(['a-001' => 'First']);
        Artisan::call('archive:backup-run', ['--json' => true]);
        $name = $this->decodeSingleJsonLine(Artisan::output())['details']['backup']['name'];

        $exitCode = Artisan::call('archive:backup-verify', ['name' => $name, '--json' => true]);
        $payload = $this->decodeSingleJsonLine(Artisan::output());

        $this->assertSame(0, $exitCode);
        $this->assertTrue($payload['ok']);
        $this->assertSame('BACKUP_VERIFIED', $payload['code']);
        $this->assertTrue($payload['details']['verification']['verified']);
    }

    public function test_backup_verify_reports_a_corrupted_backup_as_unverified_without_touching_data(): void
    {
        $this->seedRecords(['a-001' => 'First']);
        Artisan::call('archive:backup-run', ['--json' => true]);
        $name = $this->decodeSingleJsonLine(Artisan::output())['details']['backup']['name'];

        $path = $this->backupDir.DIRECTORY_SEPARATOR.$name;
        file_put_contents($path, file_get_contents($path).'corruption');

        $before = DB::table('storage_rows')->orderBy('uid')->get();

        $exitCode = Artisan::call('archive:backup-verify', ['name' => $name, '--json' => true]);
        $payload = $this->decodeSingleJsonLine(Artisan::output());

        $this->assertNotSame(0, $exitCode);
        $this->assertFalse($payload['ok']);
        $this->assertSame('BACKUP_UNVERIFIED', $payload['code']);
        $this->assertFalse($payload['details']['verification']['verified']);

        $after = DB::table('storage_rows')->orderBy('uid')->get();
        $this->assertEquals($before, $after);
    }

    public function test_backup_restore_refuses_without_force(): void
    {
        $this->seedRecords(['a-001' => 'First']);
        Artisan::call('archive:backup-run', ['--json' => true]);
        $name = $this->decodeSingleJsonLine(Artisan::output())['details']['backup']['name'];

        $before = DB::table('storage_rows')->orderBy('uid')->get();

        $exitCode = Artisan::call('archive:backup-restore', ['name' => $name, '--json' => true]);
        $payload = $this->decodeSingleJsonLine(Artisan::output());

        $this->assertNotSame(0, $exitCode);
        $this->assertFalse($payload['ok']);
        $this->assertSame('FORCE_REQUIRED', $payload['code']);

        $after = DB::table('storage_rows')->orderBy('uid')->get();
        $this->assertEquals($before, $after);
    }

    public function test_backup_restore_refuses_a_tampered_backup_and_leaves_live_data_untouched(): void
    {
        $this->seedRecords(['a-001' => 'First', 'a-002' => 'Second']);
        Artisan::call('archive:backup-run', ['--json' => true]);
        $name = $this->decodeSingleJsonLine(Artisan::output())['details']['backup']['name'];

        $path = $this->backupDir.DIRECTORY_SEPARATOR.$name;
        file_put_contents($path, file_get_contents($path).'corruption');

        $before = DB::table('storage_rows')->orderBy('uid')->get();

        $exitCode = Artisan::call('archive:backup-restore', ['name' => $name, '--force' => true, '--json' => true]);
        $payload = $this->decodeSingleJsonLine(Artisan::output());

        $this->assertNotSame(0, $exitCode);
        $this->assertFalse($payload['ok']);
        $this->assertSame('RESTORE_FAILED', $payload['code']);
        $this->assertStringContainsString('live data was not touched', $payload['message']);

        $after = DB::table('storage_rows')->orderBy('uid')->get();
        $this->assertEquals($before, $after);
    }

    public function test_backup_restore_applies_a_valid_backup_with_force(): void
    {
        $this->seedRecords(['a-001' => 'First', 'a-002' => 'Second']);
        Artisan::call('archive:backup-run', ['--json' => true]);
        $name = $this->decodeSingleJsonLine(Artisan::output())['details']['backup']['name'];

        DB::table('storage_rows')->where('uid', 'a-002')->delete();
        $this->seedRecords(['a-003' => 'Added after backup']);

        $exitCode = Artisan::call('archive:backup-restore', ['name' => $name, '--force' => true, '--json' => true]);
        $payload = $this->decodeSingleJsonLine(Artisan::output());

        $this->assertSame(0, $exitCode);
        $this->assertTrue($payload['ok']);
        $this->assertSame('RESTORE_COMPLETE', $payload['code']);
        $this->assertTrue($payload['details']['result']['verified']);

        $uids = DB::table('storage_rows')->where('store', 'archive-items')->orderBy('uid')->pluck('uid')->all();
        $this->assertSame(['a-001', 'a-002'], $uids);
    }

    /**
     * @param  array<string, string>  $titles
     */
    private function seedRecords(array $titles): void
    {
        $now = now();

        foreach ($titles as $uid => $title) {
            DB::table('storage_rows')->insert([
                'store' => 'archive-items',
                'uid' => $uid,
                'data' => json_encode(['id' => $uid, 'uid' => $uid, 'title' => $title]),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeSingleJsonLine(string $output): array
    {
        $lines = array_values(array_filter(explode("\n", $output), static fn (string $line): bool => trim($line) !== ''));
        $this->assertCount(1, $lines, 'Expected exactly one non-empty stdout line in --json mode: '.$output);

        $decoded = json_decode($lines[0], true);
        $this->assertIsArray($decoded, 'Expected the single output line to be valid JSON: '.$lines[0]);

        return $decoded;
    }
}
