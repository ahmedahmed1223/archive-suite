<?php

namespace Tests\Unit;

use App\Services\Media\SymfonyProcessRunner;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Tests\TestCase;

class SymfonyProcessRunnerTest extends TestCase
{
    public function test_it_honors_the_configured_process_timeout(): void
    {
        $this->expectException(ProcessTimedOutException::class);

        (new SymfonyProcessRunner(1))->run([
            PHP_BINARY,
            '-r',
            'sleep(2);',
        ]);
    }
}
