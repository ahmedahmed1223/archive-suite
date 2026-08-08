<?php

namespace Tests\Feature;

use Tests\TestCase;

class NativeStorageConfigTest extends TestCase
{
    /** @var array<string, string|false> */
    private array $original = [];

    protected function tearDown(): void
    {
        foreach ($this->original as $key => $value) {
            if ($value === false) {
                putenv($key);
                unset($_ENV[$key], $_SERVER[$key]);
            } else {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
        parent::tearDown();
    }

    private function setEnvironment(string $key, string $value): void
    {
        $this->original[$key] = getenv($key);
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }

    public function test_native_storage_roots_can_live_outside_the_application_installation(): void
    {
        $this->setEnvironment('ARCHIVE_LOCAL_STORAGE_PATH', '/srv/archive/private');
        $this->setEnvironment('ARCHIVE_PUBLIC_STORAGE_PATH', '/srv/archive/public');

        /** @var array<string, mixed> $filesystems */
        $filesystems = require config_path('filesystems.php');

        $this->assertSame('/srv/archive/private', $filesystems['disks']['local']['root']);
        $this->assertSame('/srv/archive/public', $filesystems['disks']['public']['root']);
    }
}
