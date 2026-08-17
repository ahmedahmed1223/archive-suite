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
        $result = (new SymfonyProcessRunner)->run([
            PHP_BINARY,
            '-r',
            'fwrite(STDERR, "diagnostic error"); exit(1);',
        ]);

        $this->assertSame(1, $result['exitCode']);
        $this->assertStringContainsString('diagnostic error', $result['stderr']);
        $this->assertFalse($result['canceled']);
    }

    /**
     * V3-PERF-005: a MediaJob cancellation must actually stop a running
     * ffmpeg subprocess, not just be noticed after it finishes on its own.
     * Real subprocess (not a fake) so this proves Process::stop() actually
     * kills it -- a 5s sleep that returns in well under that is the signal.
     */
    public function test_it_kills_the_subprocess_as_soon_as_is_canceled_returns_true(): void
    {
        $start = microtime(true);

        $result = (new SymfonyProcessRunner(10))->run(
            [PHP_BINARY, '-r', 'sleep(5); exit(0);'],
            null,
            fn (): bool => true,
        );

        $elapsed = microtime(true) - $start;

        $this->assertTrue($result['canceled']);
        $this->assertLessThan(4.0, $elapsed, 'a canceled run should be killed well before the 5s sleep finishes');
    }

    public function test_it_runs_to_completion_when_is_canceled_never_trips(): void
    {
        $result = (new SymfonyProcessRunner)->run(
            [PHP_BINARY, '-r', 'exit(0);'],
            null,
            fn (): bool => false,
        );

        $this->assertSame(0, $result['exitCode']);
        $this->assertFalse($result['canceled']);
    }
}
