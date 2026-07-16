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

    public function test_it_preserves_stderr_after_streaming_process_output(): void
    {
        $result = (new SymfonyProcessRunner())->run([
            PHP_BINARY,
            '-r',
            'fwrite(STDERR, "diagnostic error"); exit(1);',
        ]);

        $this->assertSame(1, $result['exitCode']);
        $this->assertStringContainsString('diagnostic error', $result['stderr']);
    }
}
