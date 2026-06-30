<?php

namespace App\Services\Media;

class FakeProcessRunner implements ProcessRunner
{
    /**
     * Last command received by the fake runner.
     *
     * @var string[]
     */
    private array $lastCommand = [];

    /**
     * Map of command patterns to canned responses.
     * Keyed by the second element (typically the operation or input type).
     *
     * @var array<string, array{exitCode: int, stdout: string, stderr: string}>
     */
    private array $responses = [];

    public function __construct()
    {
        // Default responses for common ffmpeg/ffprobe operations
        $this->responses = [
            'thumbnail' => [
                'exitCode' => 0,
                'stdout' => '',
                'stderr' => 'frame=   10 fps=0.0 q=-1.0 time=00:00:00.50 bitrate=N/A',
            ],
            'transcode' => [
                'exitCode' => 0,
                'stdout' => '',
                'stderr' => 'frame=  100 fps=50 q=-1.0 time=00:00:05.00 bitrate=N/A',
            ],
            'transcription' => [
                'exitCode' => 0,
                'stdout' => '',
                'stderr' => '',
            ],
        ];
    }

    /**
     * Set a custom response for a command pattern.
     */
    public function setResponse(string $key, array $response): void
    {
        $this->responses[$key] = $response;
    }

    /**
     * @return string[]
     */
    public function lastCommand(): array
    {
        return $this->lastCommand;
    }

    /**
     * Run a fake command.
     *
     * @param  string[]  $command
     */
    public function run(array $command, ?callable $onProgress = null): array
    {
        $this->lastCommand = $command;

        // For testing: match against common patterns in the command
        $key = 'default';
        foreach ($command as $arg) {
            if (str_contains($arg, 'thumb')) {
                $key = 'thumbnail';
                break;
            }
            if (str_contains($arg, 'transcode') || str_contains($arg, '.mp4')) {
                $key = 'transcode';
                break;
            }
            if (str_contains($arg, 'transcription') || str_contains($arg, 'transcript')) {
                $key = 'transcription';
                break;
            }
        }

        $response = $this->responses[$key] ?? [
            'exitCode' => 0,
            'stdout' => '',
            'stderr' => '',
        ];

        if ($response['exitCode'] === 0 && $onProgress && $response['stderr']) {
            $onProgress($response['stderr']);
        }

        return $response;
    }
}
