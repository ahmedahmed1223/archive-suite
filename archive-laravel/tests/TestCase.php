<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Passport\Passport;

abstract class TestCase extends BaseTestCase
{
    private static bool $passportKeysPrepared = false;

    protected function setUp(): void
    {
        parent::setUp();

        if (self::$passportKeysPrepared) {
            return;
        }

        $keyPath = sys_get_temp_dir().DIRECTORY_SEPARATOR.'archive-suite-passport-test-keys';
        Passport::loadKeysFrom($keyPath);

        if (! is_dir($keyPath)) {
            mkdir($keyPath, 0700, true);
        }

        Artisan::call('passport:keys', ['--force' => true]);
        self::$passportKeysPrepared = true;
    }
}
