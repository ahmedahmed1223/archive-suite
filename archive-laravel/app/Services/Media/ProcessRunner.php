<?php

namespace App\Services\Media;

interface ProcessRunner
{
    /**
     * Run a command and return exit code and output.
     *
     * @param  string[]  $command
     * @return array{exitCode: int, stdout: string, stderr: string}
     */
    public function run(array $command, ?callable $onProgress = null): array;
}
