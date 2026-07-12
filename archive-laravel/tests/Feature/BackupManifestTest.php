<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * V1-121: full DB + file coverage, manifest with checksums, and per-file
 * checksum verification before restore. Builds on the V1-122 whole-archive
 * checksum gate covered by BackupsApiTest.
 */
class BackupManifestTest extends TestCase
{
    use RefreshDatabase;

    private string $backupDir;

    private string $fileRoot;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backupDir = storage_path('framework/testing/backups-'.uniqid());
        $this->fileRoot = storage_path('framework/testing/archive-files-'.uniqid());
        config(['archive.backup_path' => $this->backupDir]);
        config(['archive.file_root' => $this->fileRoot]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backupDir);
        File::deleteDirectory($this->fileRoot);

        parent::tearDown();
    }

    public function test_backup_manifest_lists_table_row_counts_and_file_checksums(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First', 'a-002' => 'Second']);

        File::makeDirectory($this->fileRoot.'/thumbnails', 0755, true);
        File::put($this->fileRoot.'/thumbnails/example.txt', 'thumbnail bytes');
        $expectedSha256 = hash('sha256', 'thumbnail bytes');

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)
            ->assertCreated()
            ->json('backup.name');

        $manifest = $this->decodeArchive($name)['manifest'];

        $this->assertSame('sqlite', $manifest['dbDriver']);
        $this->assertNotEmpty($manifest['createdAt']);
        $this->assertNotEmpty($manifest['appVersion']);
        $this->assertSame(2, $manifest['tables']['storage_rows']);

        $fileEntry = collect($manifest['files'])->firstWhere('path', 'thumbnails/example.txt');
        $this->assertNotNull($fileEntry);
        $this->assertSame($expectedSha256, $fileEntry['sha256']);
        $this->assertSame(strlen('thumbnail bytes'), $fileEntry['sizeBytes']);
        $this->assertSame($fileEntry['sizeBytes'], $manifest['totalSizeBytes']);
    }

    public function test_backup_covers_app_tables_beyond_storage_rows_and_restores_them(): void
    {
        $headers = $this->adminHeaders();

        DB::table('vocabulary_terms')->insert([
            'id' => 'term-1',
            'user_id' => 'user-1',
            'term' => 'Broadcast',
            'kind' => 'custom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)
            ->assertCreated()
            ->json('backup.name');

        $manifest = $this->decodeArchive($name)['manifest'];
        $this->assertSame(1, $manifest['tables']['vocabulary_terms']);

        // Wipe live data, then restore — the table beyond storage_rows must come back.
        DB::table('vocabulary_terms')->delete();

        $this->postJson('/api/v1/system/backups/restore', ['name' => $name], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('result.tableCounts.vocabulary_terms', 1);

        $this->assertSame('Broadcast', DB::table('vocabulary_terms')->where('id', 'term-1')->value('term'));
    }

    public function test_backup_restores_files_from_the_archive(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First']);

        File::makeDirectory($this->fileRoot.'/thumbnails', 0755, true);
        File::put($this->fileRoot.'/thumbnails/example.txt', 'thumbnail bytes');

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)
            ->assertCreated()
            ->json('backup.name');

        // Simulate file loss, then restore.
        File::delete($this->fileRoot.'/thumbnails/example.txt');
        $this->assertFileDoesNotExist($this->fileRoot.'/thumbnails/example.txt');

        $this->postJson('/api/v1/system/backups/restore', ['name' => $name], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertFileExists($this->fileRoot.'/thumbnails/example.txt');
        $this->assertSame('thumbnail bytes', file_get_contents($this->fileRoot.'/thumbnails/example.txt'));
    }

    public function test_restore_rejects_a_backup_with_a_tampered_file_entry_and_leaves_data_and_files_untouched(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First']);

        File::makeDirectory($this->fileRoot.'/thumbnails', 0755, true);
        File::put($this->fileRoot.'/thumbnails/example.txt', 'original bytes');

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)
            ->assertCreated()
            ->json('backup.name');

        $path = $this->backupDir.DIRECTORY_SEPARATOR.$name;
        $payload = $this->decodeArchive($name);

        // Corrupt one file's embedded content while leaving its recorded sha256
        // (and every other checksum) untouched — this only trips the new
        // per-file manifest check, not the pre-existing whole-archive gate.
        $payload['files'][0]['contentBase64'] = base64_encode('tampered bytes');

        $encoded = gzencode(json_encode($payload), 9);
        file_put_contents($path, $encoded);
        file_put_contents($path.'.sha256', hash('sha256', $encoded));

        $before = DB::table('storage_rows')->where('store', 'archive-items')->orderBy('uid')->get();

        $this->postJson('/api/v1/system/backups/restore', ['name' => $name], $headers)
            ->assertStatus(422)
            ->assertJsonPath('ok', false);

        $after = DB::table('storage_rows')->where('store', 'archive-items')->orderBy('uid')->get();
        $this->assertEquals($before, $after);
        $this->assertSame('original bytes', file_get_contents($this->fileRoot.'/thumbnails/example.txt'));
    }

    /**
     * @return array{manifest: array<string, mixed>, tables: array<string, mixed>, files: array<int, array<string, mixed>>}
     */
    private function decodeArchive(string $name): array
    {
        $path = $this->backupDir.DIRECTORY_SEPARATOR.$name;

        return json_decode((string) gzdecode((string) file_get_contents($path)), true);
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
     * @return array<string, string>
     */
    private function adminHeaders(): array
    {
        $admin = User::query()->create([
            'name' => 'Admin',
            'email' => 'backup-manifest-admin@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $admin->email,
            'password' => 'secret-password',
        ])->assertOk();

        return ['Authorization' => 'Bearer '.$login->json('accessToken')];
    }
}
