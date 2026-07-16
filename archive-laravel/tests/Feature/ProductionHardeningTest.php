<?php

namespace Tests\Feature;

use App\Models\User;
use App\Providers\AppServiceProvider;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

/**
 * V1-101: production must refuse a default/weak seeded admin and an
 * insecure refresh cookie. See DatabaseSeeder::assertStrongAdminCredentials()
 * and AppServiceProvider::assertSecureCookiesInProduction().
 */
class ProductionHardeningTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, string|false> original getenv() values, restored in tearDown */
    private array $envBackup = [];

    protected function tearDown(): void
    {
        foreach ($this->envBackup as $key => $original) {
            if ($original === false) {
                putenv($key);
                unset($_ENV[$key], $_SERVER[$key]);
            } else {
                putenv("{$key}={$original}");
                $_ENV[$key] = $original;
                $_SERVER[$key] = $original;
            }
        }
        $this->envBackup = [];

        parent::tearDown();
    }

    /**
     * ponytail: env() may resolve via putenv/$_ENV/$_SERVER depending on
     * which Dotenv adapter answers first — set all three so overrides are
     * visible regardless, and unset all three to simulate "not set".
     */
    private function setEnv(string $key, ?string $value): void
    {
        if (! array_key_exists($key, $this->envBackup)) {
            $this->envBackup[$key] = getenv($key);
        }

        if ($value === null) {
            putenv($key);
            unset($_ENV[$key], $_SERVER[$key]);
        } else {
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }

    private function runSeederAs(string $environment): void
    {
        $this->app->detectEnvironment(fn () => $environment);
        (new DatabaseSeeder())->setContainer($this->app)->run();
    }

    public function test_seeder_throws_in_production_when_admin_password_unset(): void
    {
        $this->setEnv('ADMIN_EMAIL', 'ops@real-org.example.com');
        $this->setEnv('ADMIN_PASSWORD', null);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/ADMIN_PASSWORD/');

        $this->runSeederAs('production');
    }

    public function test_seeder_throws_in_production_when_admin_password_is_change_me(): void
    {
        $this->setEnv('ADMIN_EMAIL', 'ops@real-org.example.com');
        $this->setEnv('ADMIN_PASSWORD', 'CHANGE_ME_ADMIN_PASSWORD');

        $this->expectException(RuntimeException::class);

        $this->runSeederAs('production');
    }

    public function test_seeder_throws_in_production_when_admin_password_is_weak_literal(): void
    {
        $this->setEnv('ADMIN_EMAIL', 'ops@real-org.example.com');
        $this->setEnv('ADMIN_PASSWORD', 'password');

        $this->expectException(RuntimeException::class);

        $this->runSeederAs('production');
    }

    public function test_seeder_throws_in_production_when_admin_password_too_short(): void
    {
        $this->setEnv('ADMIN_EMAIL', 'ops@real-org.example.com');
        $this->setEnv('ADMIN_PASSWORD', 'Sh0rt!1');

        $this->expectException(RuntimeException::class);

        $this->runSeederAs('production');
    }

    public function test_seeder_throws_in_production_when_admin_email_is_default(): void
    {
        $this->setEnv('ADMIN_EMAIL', 'test@example.com');
        $this->setEnv('ADMIN_PASSWORD', 'CorrectHorseBatteryStaple9!');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/ADMIN_EMAIL/');

        $this->runSeederAs('production');
    }

    public function test_seeder_succeeds_in_production_with_strong_credentials(): void
    {
        $this->setEnv('ADMIN_EMAIL', 'ops@real-org.example.com');
        $this->setEnv('ADMIN_PASSWORD', 'CorrectHorseBatteryStaple9!');

        $this->runSeederAs('production');

        $admin = User::query()->where('email', 'ops@real-org.example.com')->firstOrFail();
        $this->assertNotSame('CorrectHorseBatteryStaple9!', $admin->getRawOriginal('password'));
        $this->assertTrue(Hash::check('CorrectHorseBatteryStaple9!', $admin->password));
    }

    public function test_seeder_assigns_the_configured_admin_role(): void
    {
        $this->setEnv('ADMIN_EMAIL', 'ops@real-org.example.com');
        $this->setEnv('ADMIN_PASSWORD', 'CorrectHorseBatteryStaple9!');

        $this->runSeederAs('production');

        $this->assertDatabaseHas('users', [
            'email' => 'ops@real-org.example.com',
            'role' => 'admin',
        ]);
    }

    public function test_seeder_still_works_in_testing_env_with_defaults(): void
    {
        $this->setEnv('ADMIN_EMAIL', null);
        $this->setEnv('ADMIN_PASSWORD', null);

        // phpunit.xml sets APP_ENV=testing — this is the ambient environment already.
        $this->runSeederAs('testing');

        $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
    }

    public function test_seeder_still_works_in_local_env_with_defaults(): void
    {
        $this->setEnv('ADMIN_EMAIL', null);
        $this->setEnv('ADMIN_PASSWORD', null);

        $this->runSeederAs('local');

        $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
    }

    public function test_secure_cookie_guard_throws_in_production_when_insecure(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        config(['app.url' => 'https://archive.example.com']);
        config(['archive.auth.secure_cookies' => false]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/ARCHIVE_SECURE_COOKIES/');

        (new AppServiceProvider($this->app))->boot();
    }

    public function test_secure_cookie_guard_passes_in_production_when_secure(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        config(['archive.auth.secure_cookies' => true]);

        (new AppServiceProvider($this->app))->boot();

        $this->addToAssertionCount(1);
    }

    public function test_secure_cookie_guard_does_not_throw_in_testing(): void
    {
        config(['archive.auth.secure_cookies' => false]);

        (new AppServiceProvider($this->app))->boot();

        $this->addToAssertionCount(1);
    }

    public function test_secure_cookie_guard_does_not_throw_in_local(): void
    {
        $this->app->detectEnvironment(fn () => 'local');
        config(['archive.auth.secure_cookies' => false]);

        (new AppServiceProvider($this->app))->boot();

        $this->addToAssertionCount(1);
    }
}
