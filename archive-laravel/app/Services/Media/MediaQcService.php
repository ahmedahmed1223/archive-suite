<?php

declare(strict_types=1);

namespace App\Services\Media;

use RuntimeException;

/**
 * Executes the deterministic, non-AI quality gates used by archive intake.
 * Every invocation uses argv arrays through ProcessRunner; user-controlled
 * file paths never enter a shell command or a filter expression.
 */
final class MediaQcService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly MediaPathGuard $pathGuard,
        private readonly string $ffmpegPath = 'ffmpeg',
        private readonly string $ffprobePath = 'ffprobe',
        private readonly array $policy = [],
    ) {}

    /** @return array<string, mixed> */
    public function inspect(string $sourcePath, ?callable $shouldCancel = null): array
    {
        $source = $this->pathGuard->resolveInput($sourcePath, 'sourcePath');
        $policy = $this->resolvedPolicy();
        $decode = $this->run([$this->ffmpegPath, '-v', 'error', '-i', $source, '-f', 'null', '-'], $shouldCancel);
        $findings = [$this->finding('decode', 0, null, $decode['exitCode'] === 0 ? 'passed' : 'failed', trim($decode['stderr']) ?: 'Media stream decoded successfully.')];

        if ($decode['exitCode'] !== 0) {
            return $this->report($findings, ['decodeExitCode' => $decode['exitCode']]);
        }

        $probe = (new MediaProbeService($this->runner, $this->pathGuard, $this->ffprobePath))->inspect($sourcePath, $shouldCancel);
        $streams = is_array($probe['streams'] ?? null) ? $probe['streams'] : [];
        $hasVideo = $this->hasStreamType($streams, 'video');
        $hasAudio = $this->hasStreamType($streams, 'audio');

        $findings[] = $this->finding('expected_video', 0, null, $hasVideo || ! $policy['requireVideo'] ? 'passed' : 'failed', $hasVideo ? 'A video stream is present.' : 'No video stream is present.');
        $findings[] = $this->finding('expected_audio', 0, null, $hasAudio || ! $policy['requireAudio'] ? 'passed' : 'failed', $hasAudio ? 'An audio stream is present.' : 'No audio stream is present.');

        if ($hasVideo) {
            $video = $this->run([
                $this->ffmpegPath, '-hide_banner', '-nostats', '-v', 'info', '-i', $source,
                '-vf', "blackdetect=d={$policy['blackMinDurationSeconds']}:pix_th={$policy['blackPixelThreshold']},freezedetect=n={$policy['freezeNoise']}:d={$policy['freezeMinDurationSeconds']}",
                '-an', '-f', 'null', '-',
            ], $shouldCancel);
            $findings = [...$findings, ...$this->blackFindings($video['stderr']), ...$this->freezeFindings($video['stderr'])];
        }

        $metrics = ['decodeExitCode' => $decode['exitCode']];
        if ($hasAudio) {
            $audio = $this->run([
                $this->ffmpegPath, '-hide_banner', '-nostats', '-v', 'info', '-i', $source,
                '-af', "silencedetect=n={$policy['silenceNoiseDb']}dB:d={$policy['silenceMinDurationSeconds']},volumedetect",
                '-vn', '-f', 'null', '-',
            ], $shouldCancel);
            $findings = [...$findings, ...$this->silenceFindings($audio['stderr'])];
            $maxVolume = $this->maxVolume($audio['stderr']);
            $metrics['maxVolumeDb'] = $maxVolume;
            $findings[] = $this->finding('audio_clipping', 0, null, $maxVolume !== null && $maxVolume >= $policy['clippingMaxVolumeDb'] ? 'failed' : 'passed', $maxVolume === null ? 'Maximum audio level was not reported.' : "Maximum audio level: {$maxVolume} dB.");

            $loudness = $this->run([$this->ffmpegPath, '-hide_banner', '-nostats', '-v', 'info', '-i', $source, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-'], $shouldCancel);
            $integratedLufs = $this->integratedLufs($loudness['stderr']);
            $metrics['integratedLufs'] = $integratedLufs;
            $loudnessStatus = $integratedLufs !== null && abs($integratedLufs - $policy['loudnessTargetLufs']) > $policy['loudnessToleranceLufs'] ? 'warning' : 'passed';
            $findings[] = $this->finding('loudness', 0, null, $loudnessStatus, $integratedLufs === null ? 'Integrated loudness was not reported.' : "Integrated loudness: {$integratedLufs} LUFS.");
        }

        return $this->report($findings, $metrics);
    }

    /** @return array{exitCode: int, stdout: string, stderr: string, canceled?: bool} */
    private function run(array $command, ?callable $shouldCancel): array
    {
        $result = $this->runner->run($command, null, $shouldCancel);
        if (($result['canceled'] ?? false) === true) {
            throw new RuntimeException('Media QC was canceled.');
        }

        return $result;
    }

    /** @return array<string, mixed> */
    private function report(array $findings, array $metrics): array
    {
        $statuses = array_column($findings, 'status');
        $status = in_array('failed', $statuses, true) ? 'failed' : (in_array('warning', $statuses, true) ? 'warning' : 'passed');

        return ['status' => $status, 'findings' => $findings, 'metrics' => $metrics];
    }

    /** @return array{rule: string, startSeconds: float, endSeconds: float|null, status: string, evidence: string} */
    private function finding(string $rule, float $start, ?float $end, string $status, string $evidence): array
    {
        return ['rule' => $rule, 'startSeconds' => $start, 'endSeconds' => $end, 'status' => $status, 'evidence' => $evidence];
    }

    /** @return list<array<string, mixed>> */
    private function blackFindings(string $log): array
    {
        preg_match_all('/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/', $log, $matches, PREG_SET_ORDER);

        return array_map(fn (array $m): array => $this->finding('black_frame', (float) $m[1], (float) $m[2], 'warning', "Black segment duration: {$m[3]} seconds."), $matches);
    }

    /** @return list<array<string, mixed>> */
    private function freezeFindings(string $log): array
    {
        preg_match_all('/freeze_start: ([\d.]+).*?freeze_end: ([\d.]+).*?freeze_duration: ([\d.]+)/s', $log, $matches, PREG_SET_ORDER);

        return array_map(fn (array $m): array => $this->finding('frozen_frame', (float) $m[1], (float) $m[2], 'warning', "Frozen segment duration: {$m[3]} seconds."), $matches);
    }

    /** @return list<array<string, mixed>> */
    private function silenceFindings(string $log): array
    {
        preg_match_all('/silence_start: ([\d.]+).*?silence_end: ([\d.]+).*?silence_duration: ([\d.]+)/s', $log, $matches, PREG_SET_ORDER);

        return array_map(fn (array $m): array => $this->finding('silence', (float) $m[1], (float) $m[2], 'warning', "Silent segment duration: {$m[3]} seconds."), $matches);
    }

    private function maxVolume(string $log): ?float
    {
        return preg_match('/max_volume:\s*(-?[\d.]+) dB/', $log, $matches) === 1 ? (float) $matches[1] : null;
    }

    private function integratedLufs(string $log): ?float
    {
        return preg_match_all('/\bI:\s*(-?[\d.]+) LUFS/', $log, $matches) && isset($matches[1]) && $matches[1] !== [] ? (float) end($matches[1]) : null;
    }

    /** @param array<int, mixed> $streams */
    private function hasStreamType(array $streams, string $type): bool
    {
        foreach ($streams as $stream) {
            if (is_array($stream) && ($stream['type'] ?? null) === $type) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string, bool|float> */
    private function resolvedPolicy(): array
    {
        return [
            'requireVideo' => (bool) ($this->policy['require_video'] ?? true),
            'requireAudio' => (bool) ($this->policy['require_audio'] ?? false),
            'blackMinDurationSeconds' => (float) ($this->policy['black_min_duration_seconds'] ?? 1),
            'blackPixelThreshold' => (float) ($this->policy['black_pixel_threshold'] ?? 0.10),
            'freezeMinDurationSeconds' => (float) ($this->policy['freeze_min_duration_seconds'] ?? 2),
            'freezeNoise' => (float) ($this->policy['freeze_noise'] ?? 0.003),
            'silenceMinDurationSeconds' => (float) ($this->policy['silence_min_duration_seconds'] ?? 2),
            'silenceNoiseDb' => (float) ($this->policy['silence_noise_db'] ?? -50),
            'clippingMaxVolumeDb' => (float) ($this->policy['clipping_max_volume_db'] ?? -1),
            'loudnessTargetLufs' => (float) ($this->policy['loudness_target_lufs'] ?? -23),
            'loudnessToleranceLufs' => (float) ($this->policy['loudness_tolerance_lufs'] ?? 3),
        ];
    }
}
