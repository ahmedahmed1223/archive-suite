<?php

declare(strict_types=1);

namespace App\Services\Media;

/**
 * Parses and serializes SRT/WebVTT cue text. Cues are always represented as
 * the plain array shape {startSeconds, endSeconds, text} -- the same shape
 * RecordTranscriptController has stored in storage_rows since V3-MEDIA-005's
 * predecessor, kept here so callers never duplicate the timecode regex.
 *
 * ponytail: no cue styling/positioning support (VTT cue settings, SRT
 * karaoke tags); add if a consumer needs it.
 */
class SubtitleCueCodec
{
    /**
     * Accepts either SRT (comma millisecond separator) or WebVTT (dot
     * separator, optional "WEBVTT" header) content -- both use the same
     * "block separated by a blank line, one timing line, then text" shape.
     *
     * @return array<int, array{startSeconds: float, endSeconds: float, text: string}>
     */
    public static function parse(string $content): array
    {
        $cues = [];
        foreach (preg_split('/\R{2,}/u', trim($content)) ?: [] as $block) {
            $lines = preg_split('/\R/u', trim($block)) ?: [];
            $timeIndex = null;
            foreach ($lines as $index => $line) {
                if (str_contains($line, '-->')) {
                    $timeIndex = $index;
                    break;
                }
            }
            if ($timeIndex === null || ! preg_match(
                '/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/u',
                trim($lines[$timeIndex]),
                $match
            )) {
                continue;
            }
            $text = trim(implode("\n", array_slice($lines, $timeIndex + 1)));
            if ($text === '') {
                continue;
            }
            $cues[] = [
                'startSeconds' => self::seconds($match[1], $match[2], $match[3], $match[4]),
                'endSeconds' => self::seconds($match[5], $match[6], $match[7], $match[8]),
                'text' => $text,
            ];
        }

        return $cues;
    }

    /**
     * @param  array<int, array{startSeconds: float, endSeconds: float, text: string}>  $cues
     */
    public static function toSrt(array $cues): string
    {
        $blocks = [];
        foreach (array_values($cues) as $index => $cue) {
            $blocks[] = sprintf(
                "%d\n%s --> %s\n%s",
                $index + 1,
                self::formatTimecode((float) $cue['startSeconds'], ','),
                self::formatTimecode((float) $cue['endSeconds'], ','),
                (string) $cue['text']
            );
        }

        return implode("\n\n", $blocks)."\n";
    }

    /**
     * @param  array<int, array{startSeconds: float, endSeconds: float, text: string}>  $cues
     */
    public static function toVtt(array $cues): string
    {
        $blocks = ['WEBVTT'];
        foreach (array_values($cues) as $cue) {
            $blocks[] = sprintf(
                "%s --> %s\n%s",
                self::formatTimecode((float) $cue['startSeconds'], '.'),
                self::formatTimecode((float) $cue['endSeconds'], '.'),
                (string) $cue['text']
            );
        }

        return implode("\n\n", $blocks)."\n";
    }

    /**
     * @param  array<int, array{startSeconds: float, endSeconds: float, text: string}>  $cues
     */
    public static function serialize(array $cues, string $format): string
    {
        return $format === 'vtt' ? self::toVtt($cues) : self::toSrt($cues);
    }

    private static function seconds(string $hours, string $minutes, string $seconds, string $milliseconds): float
    {
        return ((int) $hours * 3600) + ((int) $minutes * 60) + (int) $seconds + ((int) $milliseconds / 1000);
    }

    private static function formatTimecode(float $totalSeconds, string $millisSeparator): string
    {
        $safe = max(0.0, $totalSeconds);
        $hours = (int) floor($safe / 3600);
        $minutes = (int) floor(($safe - $hours * 3600) / 60);
        $seconds = (int) floor($safe - $hours * 3600 - $minutes * 60);
        $millis = (int) round(($safe - floor($safe)) * 1000);
        if ($millis === 1000) {
            $millis = 0;
            $seconds++;
        }

        return sprintf('%02d:%02d:%02d%s%03d', $hours, $minutes, $seconds, $millisSeparator, $millis);
    }
}
