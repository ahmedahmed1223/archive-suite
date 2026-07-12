<?php

namespace App\Services\Media;

class AudioPreprocessor
{
    private readonly MediaPathGuard $pathGuard;

    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly string $ffmpegPath = 'ffmpeg',
        private readonly int $segmentDurationSeconds = 300,
        ?MediaPathGuard $pathGuard = null,
    ) {
        $this->pathGuard = $pathGuard ?? new MediaPathGuard();
    }

    /**
     * Extract audio from video/audio source and return normalized mono 16kHz WAV path.
     * $sourcePath is expected to already be a resolved, contained absolute path
     * (the caller resolves it once via MediaPathGuard::resolveInput). Throws if
     * extraction fails.
     */
    public function extractAudio(string $sourcePath, string $recordId): string
    {
        $audioKey = "{$recordId}/audio_extracted.wav";
        $audioPath = $this->pathGuard->resolveOutput($audioKey, 'audio extraction output');

        $command = [
            $this->ffmpegPath,
            '-i', $sourcePath,
            '-vn',
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            $audioPath,
        ];

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("Audio extraction failed: {$result['stderr']}");
        }

        if (!is_file($audioPath)) {
            throw new \RuntimeException("Audio extraction completed but file not found: {$audioPath}");
        }

        return $audioPath;
    }

    /**
     * Plan audio segments by detecting silence boundaries when possible, with hard-split fallback.
     * Returns segment info: [{startSec, endSec, durationSec}, ...].
     * ponytail: silence detection via ffmpeg is best-effort; if unavailable, hard-split is safe.
     *
     * @return array<int, array{startSec: float, endSec: float, durationSec: float}>
     */
    public function planSegments(string $audioPath): array
    {
        // Detect total duration first
        $durationSec = $this->getAudioDuration($audioPath);
        if ($durationSec <= $this->segmentDurationSeconds) {
            return [[
                'startSec' => 0,
                'endSec' => $durationSec,
                'durationSec' => $durationSec,
            ]];
        }

        // Try silence detection; fall back to hard-split if unavailable
        $silenceBoundaries = $this->detectSilenceBoundaries($audioPath);
        if (!empty($silenceBoundaries)) {
            return $this->segmentAtSilence($silenceBoundaries, $durationSec);
        }

        return $this->segmentHard($durationSec);
    }

    /**
     * Extract audio segment as WAV and return path.
     */
    public function extractSegment(string $audioPath, string $recordId, int $segmentIndex, float $startSec, float $endSec): string
    {
        $segmentKey = "{$recordId}/segment_{$segmentIndex}.wav";
        $segmentPath = $this->pathGuard->resolveOutput($segmentKey, 'segment extraction output');
        $duration = $endSec - $startSec;

        $command = [
            $this->ffmpegPath,
            '-i', $audioPath,
            '-ss', (string) $startSec,
            '-t', (string) $duration,
            '-c', 'copy',
            $segmentPath,
        ];

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("Segment extraction failed: {$result['stderr']}");
        }

        if (!is_file($segmentPath)) {
            throw new \RuntimeException("Segment extraction completed but file not found: {$segmentPath}");
        }

        return $segmentPath;
    }

    private function getAudioDuration(string $audioPath): float
    {
        $command = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1:nokey=1',
            $audioPath,
        ];

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("Failed to get audio duration: {$result['stderr']}");
        }

        $duration = (float) trim($result['stdout']);
        return max(0.1, $duration); // Ensure at least 0.1s
    }

    /**
     * Detect silence boundaries via ffmpeg silencedetect filter.
     * Returns array of silence start times; returns empty array on filter unavailable.
     * ponytail: silencedetect threshold tuned for speech; adjust per language if needed.
     *
     * @return array<int, float>
     */
    private function detectSilenceBoundaries(string $audioPath): array
    {
        // Use silencedetect with -60dB threshold and 200ms min silence duration
        $command = [
            'ffmpeg',
            '-i', $audioPath,
            '-af', 'silencedetect=n=-60dB:d=0.2',
            '-f', 'null',
            '-',
        ];

        $result = $this->runner->run($command);
        if ($result['exitCode'] !== 0) {
            return []; // Silencedetect unavailable; caller will use hard-split
        }

        $boundaries = [];
        $stderr = $result['stderr'] . $result['stdout'];
        if (preg_match_all('/silence_end:\s*([\d.]+)/', $stderr, $matches)) {
            foreach ($matches[1] as $endTime) {
                $boundaries[] = (float) $endTime;
            }
        }

        return $boundaries;
    }

    /**
     * Break silence boundaries into segments that respect max segment duration.
     *
     * @param  array<int, float>  $boundaries
     * @return array<int, array{startSec: float, endSec: float, durationSec: float}>
     */
    private function segmentAtSilence(array $boundaries, float $totalDuration): array
    {
        $segments = [];
        $startSec = 0;

        foreach ($boundaries as $boundary) {
            if ($boundary - $startSec >= $this->segmentDurationSeconds) {
                $endSec = $boundary;
                $segments[] = [
                    'startSec' => $startSec,
                    'endSec' => $endSec,
                    'durationSec' => $endSec - $startSec,
                ];
                $startSec = $endSec;
            }
        }

        // Add final segment
        if ($startSec < $totalDuration) {
            $segments[] = [
                'startSec' => $startSec,
                'endSec' => $totalDuration,
                'durationSec' => $totalDuration - $startSec,
            ];
        }

        return !empty($segments) ? $segments : [[
            'startSec' => 0,
            'endSec' => $totalDuration,
            'durationSec' => $totalDuration,
        ]];
    }

    /**
     * Hard-split audio into equal-duration segments.
     *
     * @return array<int, array{startSec: float, endSec: float, durationSec: float}>
     */
    private function segmentHard(float $totalDuration): array
    {
        $segments = [];
        $startSec = 0;

        while ($startSec < $totalDuration) {
            $endSec = min($startSec + $this->segmentDurationSeconds, $totalDuration);
            $segments[] = [
                'startSec' => $startSec,
                'endSec' => $endSec,
                'durationSec' => $endSec - $startSec,
            ];
            $startSec = $endSec;
        }

        return $segments;
    }
}
