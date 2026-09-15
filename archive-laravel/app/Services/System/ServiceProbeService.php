<?php

declare(strict_types=1);

namespace App\Services\System;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class ServiceProbeService
{
    private const CACHE_KEY = 'service_probes';
    private const CACHE_TTL = 60; // 60 seconds

    public function probe(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return [
                'ffmpeg' => $this->probeFfmpeg(),
                'ffprobe' => $this->probeFfprobe(),
                'whisper' => $this->probeWhisper(),
                'reverb' => $this->probeReverb(),
                'gpu' => $this->probeGpu(),
                'storage' => $this->probeStorage(),
            ];
        });
    }

    private function probeFfmpeg(): array
    {
        try {
            $output = shell_exec('ffmpeg -version 2>&1');
            if ($output && strpos($output, 'ffmpeg version') !== false) {
                return ['state' => 'available', 'reason' => null];
            }
            return ['state' => 'down', 'reason' => 'ffmpeg binary not found'];
        } catch (\Throwable) {
            return ['state' => 'down', 'reason' => 'ffmpeg probe failed'];
        }
    }

    private function probeFfprobe(): array
    {
        try {
            $output = shell_exec('ffprobe -version 2>&1');
            if ($output && strpos($output, 'ffprobe version') !== false) {
                return ['state' => 'available', 'reason' => null];
            }
            return ['state' => 'down', 'reason' => 'ffprobe binary not found'];
        } catch (\Throwable) {
            return ['state' => 'down', 'reason' => 'ffprobe probe failed'];
        }
    }

    private function probeWhisper(): array
    {
        $whisperEndpoint = config('services.whisper.endpoint');
        if (! $whisperEndpoint) {
            return ['state' => 'requires_setup', 'reason' => 'WHISPER_ENDPOINT not configured'];
        }

        try {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "{$whisperEndpoint}/health");
            curl_setopt($ch, CURLOPT_TIMEOUT, 3);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200) {
                return ['state' => 'available', 'reason' => null];
            }
            return ['state' => 'down', 'reason' => "Whisper responded with HTTP {$httpCode}"];
        } catch (\Throwable) {
            return ['state' => 'down', 'reason' => 'Whisper health check failed'];
        }
    }

    private function probeReverb(): array
    {
        $reverbHost = config('services.reverb.host');
        $reverbPort = config('services.reverb.port');

        if (! $reverbHost || ! $reverbPort) {
            return ['state' => 'requires_setup', 'reason' => 'Reverb not configured'];
        }

        try {
            $fp = fsockopen($reverbHost, $reverbPort, $errno, $errstr, 2);
            if ($fp) {
                fclose($fp);
                return ['state' => 'available', 'reason' => null];
            }
            return ['state' => 'down', 'reason' => "Cannot connect to Reverb: {$errstr}"];
        } catch (\Throwable) {
            return ['state' => 'down', 'reason' => 'Reverb connection failed'];
        }
    }

    private function probeGpu(): array
    {
        $gpuEnabled = config('services.gpu.enabled', false);

        if (! $gpuEnabled) {
            return ['state' => 'requires_setup', 'reason' => 'GPU processing disabled'];
        }

        try {
            $output = shell_exec('nvidia-smi --query-gpu=index --format=csv,noheader 2>&1');
            if ($output === null || empty(trim($output))) {
                return ['state' => 'down', 'reason' => 'nvidia-smi not found or no GPU detected'];
            }
            return ['state' => 'available', 'reason' => null];
        } catch (\Throwable) {
            return ['state' => 'down', 'reason' => 'GPU probe failed'];
        }
    }

    private function probeStorage(): array
    {
        $disks = config('filesystems.disks', []);
        $results = [];

        foreach ($disks as $name => $config) {
            if (! isset($config['driver'])) {
                continue;
            }

            try {
                Storage::disk($name)->exists('.');
                $results[$name] = ['state' => 'available', 'reason' => null];
            } catch (\Throwable $e) {
                $results[$name] = [
                    'state' => 'down',
                    'reason' => 'Storage connector unavailable',
                ];
            }
        }

        return $results ?: ['local' => ['state' => 'available', 'reason' => null]];
    }
}
