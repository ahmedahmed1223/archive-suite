<?php

namespace App\Services\Media;

use Symfony\Component\Process\Process;

class SymfonyProcessRunner implements ProcessRunner
{
    /** How often (seconds) the run loop checks $isCanceled while the process is alive. */
    private const CANCEL_POLL_INTERVAL_SECONDS = 0.25;

    /** Grace period for SIGTERM before Process::stop() escalates to SIGKILL. */
    private const STOP_GRACE_PERIOD_SECONDS = 5;

    public function __construct(private readonly int $timeoutSeconds = 300) {}

    /**
     * Run a command using Symfony Process.
     *
     * Without $isCanceled this behaves exactly as before (iterator-driven,
     * blocks on output). With $isCanceled, it switches to a poll loop so it
     * can check cancellation on a fixed cadence even when the subprocess is
     * quiet for a while, and can actually kill it (Process::stop()) rather
     * than only noticing cancellation after the process finishes on its own.
     *
     * @param  string[]  $command
     */
    public function run(array $command, ?callable $onProgress = null, ?callable $isCanceled = null): array
    {
        $process = new Process($command);
        $process->setTimeout($this->timeoutSeconds);
        $process->start();

        if ($isCanceled === null) {
            foreach ($process->getIterator(Process::ITER_KEEP_OUTPUT) as $type => $data) {
                if ($type === Process::ERR && $onProgress) {
                    $onProgress($data);
                }
            }

            return [
                'exitCode' => $process->getExitCode() ?? 1,
                'stdout' => $process->getOutput(),
                'stderr' => $process->getErrorOutput(),
                'canceled' => false,
            ];
        }

        while ($process->isRunning()) {
            $errorChunk = $process->getIncrementalErrorOutput();
            if ($errorChunk !== '' && $onProgress) {
                $onProgress($errorChunk);
            }
            $process->getIncrementalOutput(); // drain the cursor; getOutput() below still returns the full buffer

            if ($isCanceled()) {
                $process->stop(self::STOP_GRACE_PERIOD_SECONDS);

                return [
                    'exitCode' => $process->getExitCode() ?? 1,
                    'stdout' => $process->getOutput(),
                    'stderr' => $process->getErrorOutput(),
                    'canceled' => true,
                ];
            }

            usleep((int) (self::CANCEL_POLL_INTERVAL_SECONDS * 1_000_000));
        }

        return [
            'exitCode' => $process->getExitCode() ?? 1,
            'stdout' => $process->getOutput(),
            'stderr' => $process->getErrorOutput(),
            'canceled' => false,
        ];
    }
}
