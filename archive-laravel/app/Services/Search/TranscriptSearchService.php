<?php

namespace App\Services\Search;

class TranscriptSearchService
{
    /**
     * @return array{excerpt: string, timestampSeconds: int}|array{}
     */
    public function find(string $transcript, string $query): array
    {
        $needle = $this->normalize($query);

        if ($needle === '' || trim($transcript) === '') {
            return [];
        }

        foreach ($this->cues($transcript) as $cue) {
            if (str_contains($this->normalize($cue['text']), $needle)) {
                return [
                    'excerpt' => $cue['text'],
                    'timestampSeconds' => $cue['start'],
                ];
            }
        }

        return [];
    }

    /**
     * @return list<array{start: int, text: string}>
     */
    private function cues(string $transcript): array
    {
        $normalized = str_replace(["\r\n", "\r"], "\n", $transcript);
        $blocks = preg_split("/\n{2,}/", $normalized) ?: [];
        $cues = [];

        foreach ($blocks as $block) {
            $lines = array_values(array_filter(array_map('trim', explode("\n", $block)), static fn (string $line): bool => $line !== ''));
            $timingIndex = null;

            foreach ($lines as $index => $line) {
                if (str_contains($line, '-->')) {
                    $timingIndex = $index;
                    break;
                }
            }

            if ($timingIndex === null || ! isset($lines[$timingIndex])) {
                continue;
            }

            $parts = preg_split('/\s+-->\s+/', $lines[$timingIndex], 2);
            $start = isset($parts[0]) ? $this->seconds($parts[0]) : null;
            $text = trim(implode(' ', array_slice($lines, $timingIndex + 1)));

            if ($start === null || $text === '') {
                continue;
            }

            $cues[] = ['start' => $start, 'text' => $text];
        }

        return $cues;
    }

    private function seconds(string $timecode): ?int
    {
        if (! preg_match('/^(?:(\d{1,2}):)?(\d{2}):(\d{2})(?:[.,]\d{1,3})?/', trim($timecode), $parts)) {
            return null;
        }

        $hours = isset($parts[1]) ? (int) $parts[1] : 0;
        $minutes = (int) $parts[2];
        $seconds = (int) $parts[3];

        if ($minutes > 59 || $seconds > 59) {
            return null;
        }

        return ($hours * 3600) + ($minutes * 60) + $seconds;
    }

    private function normalize(string $value): string
    {
        return mb_strtolower(trim($value));
    }
}
