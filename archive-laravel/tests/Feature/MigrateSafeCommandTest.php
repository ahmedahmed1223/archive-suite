<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * V1-203: archive:migrate-safe wraps `migrate --force` with a preflight
 * check, a pre-migration backup, and a maintenance window. Covers the four
 * branches: nothing pending, pending + backup + success, pending + failure
 * (maintenance left on), and --skip-backup.
 */
class MigrateSafeCommandTest extends TestCase
{
    use RefreshDatabase;

    private string $backupDir;

    private ?string $extraMigrationPath = null;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backupDir = storage_path('framework/testing/migrate-safe-backups-'.uniqid());
        config(['archive.backup_path' => $this->backupDir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backupDir);

        if ($this->extraMigrationPath !== null) {
            File::deleteDirectory($this->extraMigrationPath);
        }

        // `down`/`up` write a real file on disk (APP_MAINTENANCE_DRIVER=file);
        // never let a failure-path test leave the app down for later tests.
        Artisan::call('up');

        parent::tearDown();
    }

    public function test_no_pending_migrations_skips_backup_and_exits_fast(): void
    {
        $exitCode = Artisan::call('archive:migrate-safe');

        $this->assertSame(0, $exitCode);
        $this->assertSame([], glob($this->backupDir.'/backup-*.json.gz') ?: []);
        $this->assertFalse(app()->isDownForMaintenance());
    }

    public function test_pending_migration_creates_backup_then_migrates(): void
    {
        $this->registerPendingMigration('create_migrate_safe_marker_table', successful: true);

        $exitCode = Artisan::call('archive:migrate-safe');

        $this->assertSame(0, $exitCode, Artisan::output());
        $this->assertNotEmpty(glob($this->backupDir.'/backup-*.json.gz') ?: []);
        $this->assertTrue(Schema::hasTable('migrate_safe_marker'));
        $this->assertFalse(app()->isDownForMaintenance());
    }

    public function test_failed_migration_leaves_maintenance_mode_on_and_exits_nonzero(): void
    {
        $this->registerPendingMigration('create_migrate_safe_marker_table_failing', successful: false);

        $exitCode = Artisan::call('archive:migrate-safe');

        $this->assertNotSame(0, $exitCode);
        $this->assertNotEmpty(glob($this->backupDir.'/backup-*.json.gz') ?: []);
        $this->assertTrue(app()->isDownForMaintenance());
        $this->assertStringContainsString('left in maintenance mode', Artisan::output());
    }

    public function test_skip_backup_flag_is_honored(): void
    {
        $this->registerPendingMigration('create_migrate_safe_marker_table_skip', successful: true);

        $exitCode = Artisan::call('archive:migrate-safe', ['--skip-backup' => true]);

        $this->assertSame(0, $exitCode, Artisan::output());
        $this->assertSame([], glob($this->backupDir.'/backup-*.json.gz') ?: []);
        $this->assertTrue(Schema::hasTable('migrate_safe_marker'));
    }

    private function registerPendingMigration(string $name, bool $successful): void
    {
        $this->extraMigrationPath = storage_path('framework/testing/migrate-safe-migrations-'.uniqid());
        File::makeDirectory($this->extraMigrationPath, 0755, true);

        $body = $successful
            ? "Schema::create('migrate_safe_marker', function (\Illuminate\Database\Schema\Blueprint \$table) {\n            \$table->id();\n            \$table->timestamps();\n        });"
            : "DB::statement('THIS IS NOT VALID SQL');";

        $contents = <<<PHP
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        {$body}
    }
};
PHP;

        File::put($this->extraMigrationPath."/9999_01_01_000000_{$name}.php", $contents);

        app('migrator')->path($this->extraMigrationPath);
    }
}
