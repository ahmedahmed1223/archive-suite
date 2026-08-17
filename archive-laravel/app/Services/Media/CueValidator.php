<?php

declare(strict_types=1);

namespace App\Services\Media;

/**
 * Validates a cue list before it is persisted as a transcript version.
 * Two rules only, per V3-MEDIA-005's acceptance criteria: cues must be in
 * chronological order (each cue starts no earlier than the previous one
 * started) and must not overlap (a cue may not start before the previous
 * one ends).
 */
class CueValidator
{
    /**
     * @param  array<int, array{startSeconds: float|int, endSeconds: float|int, text: string}>  $cues
     * @return array<int, string> Human-readable error messages; empty when the cue list is valid.
     */
    public static function validate(array $cues): array
    {
        $errors = [];
        $previous = null;

        foreach (array_values($cues) as $index => $cue) {
            $start = (float) $cue['startSeconds'];
            $end = (float) $cue['endSeconds'];
            $position = $index + 1;

            if ($end <= $start) {
                $errors[] = "Cue {$position}: end time must be after start time.";
            }

            if ($previous !== null) {
                if ($start < $previous['startSeconds']) {
                    $errors[] = "Cue {$position}: starts before cue {$previous['position']}, breaking chronological order.";
                } elseif ($start < $previous['endSeconds']) {
                    $errors[] = "Cue {$position}: overlaps cue {$previous['position']}.";
                }
            }

            $previous = ['startSeconds' => $start, 'endSeconds' => $end, 'position' => $position];
        }

        return $errors;
    }
}
