<?php

namespace App\Services\Media;

interface ProcessRunner
{
    /**
     * Run a command and return exit code and output.
     *
     * $isCanceled, when given, is polled periodically while the process is
     * still running; a true result stops (kills) the subprocess and returns
     * with canceled=true instead of waiting for it to finish naturally. This
     * is what lets a MediaJob cancellation actually interrupt a single-shot
     * ffmpeg call rather than only taking effect at the next checkpoint
     * (V3-PERF-005).
     *
     * @param  string[]  $command
     * @return array{exitCode: int, stdout: string, stderr: string, canceled?: bool}
     */
    public function run(array $command, ?callable $onProgress = null, ?callable $isCanceled = null): array;
}
