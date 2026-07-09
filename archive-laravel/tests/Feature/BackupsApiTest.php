<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BackupsApiTest extends TestCase
{
    use RefreshDatabase;

    private string $backupDir;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backupDir = storage_path('framework/testing/backups-'.uniqid());
        config(['archive.backup_path' => $this->backupDir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backupDir);

        parent::tearDown();
    }

    public function test_admin_sees_an_empty_backup_list_initially(): void
    {
        $this->getJson('/api/v1/system/backups', $this->adminHeaders())
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('backups', []);
    }

    public function test_admin_can_run_a_backup_and_list_it(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First', 'a-002' => 'Second']);

        $run = $this->postJson('/api/v1/system/backups/run', [], $headers)
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('backup.stores.archive-items', 2);

        $name = $run->json('backup.name');
        $this->assertMatchesRegularExpression('/^backup-[A-Za-z0-9._-]+\.json\.gz$/', $name);
        $this->assertFileExists($this->backupDir.DIRECTORY_SEPARATOR.$name);

        $this->getJson('/api/v1/system/backups', $headers)
            ->assertOk()
            ->assertJsonCount(1, 'backups')
            ->assertJsonPath('backups.0.name', $name)
            ->assertJsonStructure(['backups' => [['name', 'sizeBytes', 'createdAt']]]);
    }

    public function test_admin_can_preview_a_backup_without_restoring(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First', 'a-002' => 'Second']);

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)->json('backup.name');

        DB::table('storage_rows')->where('uid', 'a-002')->delete();

        $this->postJson('/api/v1/system/backups/preview', ['name' => $name], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('preview.name', $name)
            ->assertJsonPath('preview.stores.archive-items', 2)
            ->assertJsonPath('preview.totalRecords', 2);

        // Preview must not touch live data.
        $this->assertSame(1, DB::table('storage_rows')->where('store', 'archive-items')->count());
    }

    public function test_admin_can_restore_a_backup(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First', 'a-002' => 'Second']);

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)->json('backup.name');

        DB::table('storage_rows')->where('uid', 'a-002')->delete();
        $this->seedRecords(['a-003' => 'Added after backup']);

        $this->postJson('/api/v1/system/backups/restore', ['name' => $name], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('result.name', $name)
            ->assertJsonPath('result.counts.archive-items', 2);

        $uids = DB::table('storage_rows')->where('store', 'archive-items')->orderBy('uid')->pluck('uid')->all();
        $this->assertSame(['a-001', 'a-002'], $uids);
    }

    public function test_restore_rejects_path_traversal_names(): void
    {
        $headers = $this->adminHeaders();

        foreach (['../../etc/passwd', 'backup-..\\..\\evil.json.gz', 'not-a-backup.json.gz'] as $name) {
            $this->postJson('/api/v1/system/backups/restore', ['name' => $name], $headers)
                ->assertBadRequest()
                ->assertJsonPath('ok', false);

            $this->postJson('/api/v1/system/backups/preview', ['name' => $name], $headers)
                ->assertBadRequest()
                ->assertJsonPath('ok', false);
        }
    }

    public function test_restore_returns_404_for_a_missing_backup(): void
    {
        $this->postJson('/api/v1/system/backups/restore', [
            'name' => 'backup-2020-01-01T00-00-00-000000.json.gz',
        ], $this->adminHeaders())
            ->assertNotFound()
            ->assertJsonPath('ok', false);
    }

    public function test_backup_includes_checksum(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First']);

        $run = $this->postJson('/api/v1/system/backups/run', [], $headers)
            ->assertCreated()
            ->assertJsonPath('ok', true);

        $backup = $run->json('backup');
        $this->assertNotEmpty($backup['checksum']);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $backup['checksum']);

        // Verify checksum file exists
        $checksumFile = $this->backupDir.DIRECTORY_SEPARATOR.$backup['name'].'.sha256';
        $this->assertFileExists($checksumFile);
        $this->assertSame($backup['checksum'], trim((string) file_get_contents($checksumFile)));
    }

    public function test_admin_can_verify_backup_checksum(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First']);

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)->json('backup.name');

        $verify = $this->postJson('/api/v1/system/backups/verify', ['name' => $name], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true);

        $verification = $verify->json('verification');
        $this->assertSame($name, $verification['name']);
        $this->assertTrue($verification['verified']);
        $this->assertNotEmpty($verification['checksum']);
    }

    public function test_verify_detects_corrupted_backup(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First']);

        $name = $this->postJson('/api/v1/system/backups/run', [], $headers)->json('backup.name');

        // Corrupt the backup file
        $path = $this->backupDir.DIRECTORY_SEPARATOR.$name;
        file_put_contents($path, 'corrupted data');

        $verify = $this->postJson('/api/v1/system/backups/verify', ['name' => $name], $headers)
            ->assertOk();

        $verification = $verify->json('verification');
        $this->assertFalse($verification['verified']);
    }

    public function test_backup_list_includes_checksums(): void
    {
        $headers = $this->adminHeaders();
        $this->seedRecords(['a-001' => 'First']);

        $this->postJson('/api/v1/system/backups/run', [], $headers)->assertCreated();

        $list = $this->getJson('/api/v1/system/backups', $headers)
            ->assertOk()
            ->assertJsonPath('ok', true);

        $backups = $list->json('backups');
        $this->assertCount(1, $backups);
        $this->assertNotEmpty($backups[0]['checksum']);
    }

    public function test_non_admins_cannot_access_backups(): void
    {
        $headers = $this->viewerHeaders();

        $this->getJson('/api/v1/system/backups', $headers)->assertForbidden();
        $this->postJson('/api/v1/system/backups/run', [], $headers)->assertForbidden();
        $this->postJson('/api/v1/system/backups/preview', ['name' => 'x'], $headers)->assertForbidden();
        $this->postJson('/api/v1/system/backups/restore', ['name' => 'x'], $headers)->assertForbidden();
        $this->postJson('/api/v1/system/backups/verify', ['name' => 'x'], $headers)->assertForbidden();
        $this->postJson('/api/v1/system/backups/dr-drill', [], $headers)->assertForbidden();
    }

    public function test_unauthenticated_backup_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/system/backups')->assertUnauthorized();
        $this->postJson('/api/v1/system/backups/run')->assertUnauthorized();
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
            'email' => 'backup-admin@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($admin)];
    }

    /**
     * @return array<string, string>
     */
    private function viewerHeaders(): array
    {
        $viewer = User::query()->create([
            'name' => 'Viewer',
            'email' => 'backup-viewer@example.test',
            'password' => Hash::make('secret-password'),
            'role' => 'viewer',
        ]);

        return ['Authorization' => 'Bearer '.$this->tokenFor($viewer)];
    }

    private function tokenFor(User $user): string
    {
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk();

        return $login->json('accessToken');
    }
}
