<?php

namespace App\Services\Media;

use Symfony\Component\Process\Process;

class SymfonyProcessRunner implements ProcessRunner
{
    /**
     * Run a command using Symfony Process.
     *
     * @param  string[]  $command
     */
    public function run(array $command, ?callable $onProgress = null): array
    {
        $process = new Process($command);
        $process->setTimeout(300); // 5 min default; override per use case

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
