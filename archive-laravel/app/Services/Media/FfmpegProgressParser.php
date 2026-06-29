<?php

namespace App\Services\Media;

/**
 * Parse ffmpeg progress from stderr output.
 */
class FfmpegProgressParser
{
    /**
     * Extract progress percentage from ffmpeg stderr.
     * Looks for `time=HH:MM:SS.ms` and returns 0-100 fraction of duration.
     *
     * @param  float  $durationSec  Total duration in seconds
     * @return float|null Progress as 0.0-1.0, or null if unparseable
     */
    public static function parse(string $output, float $durationSec): ?float
    {
        if ($durationSec <= 0 || ! is_finite($durationSec)) {
            return null;
        }

        // Match time=HH:MM:SS.ms pattern
        if (! preg_match('/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/', $output, $matches)) {
            return null;
        }

        $hours = (int) $matches[1];
        $minutes = (int) $matches[2];
        $seconds = (float) $matches[3];

        $currentTime = $hours * 3600 + $minutes * 60 + $seconds;

        return min(1.0, max(0.0, $currentTime / $durationSec));
    }
}
