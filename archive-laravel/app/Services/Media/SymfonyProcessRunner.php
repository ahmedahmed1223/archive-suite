<?php

namespace App\Services\Media;

use Symfony\Component\Process\Process;

class SymfonyProcessRunner implements ProcessRunner
{
    public function __construct(private readonly int $timeoutSeconds = 300)
    {
    }

    /**
     * Run a command using Symfony Process.
     *
     * @param  string[]  $command
     */
    public function run(array $command, ?callable $onProgress = null): array
    {
        $process = new Process($command);
        $process->setTimeout($this->timeoutSeconds);

        $process->start();

        foreach ($process as $type => $data) {
            if ($type === Process::ERR && $onProgress) {
                $onProgress($data);
            }
        }

        return [
            'exitCode' => $process->getExitCode() ?? 1,
            'stdout' => $process->getOutput(),
            'stderr' => $process->getErrorOutput(),
        ];
    }
}
