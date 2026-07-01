<?php

namespace App\Services\Media;

class VttToTtmlConverter
{
    /**
     * Convert a WEBVTT transcript string into a minimal TTML document.
     * Deterministic, dependency-free: parses cue timings + text only.
     * ponytail: no styling/positioning support, add if a consumer needs it.
     */
    public static function convert(string $vtt): string
    {
        $lines = preg_split('/\r\n|\r|\n/', trim($vtt));
        $cues = [];
        $current = null;

        foreach ($lines as $line) {
            if (preg_match('/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/', $line, $m)) {
                if ($current !== null) {
                    $cues[] = $current;
                }
                $current = ['start' => $m[1], 'end' => $m[2], 'text' => []];
                continue;
            }

            if ($current === null || $line === '' || $line === 'WEBVTT') {
                continue;
            }

            $current['text'][] = $line;
        }

        if ($current !== null) {
            $cues[] = $current;
        }

        $body = '';
        foreach ($cues as $cue) {
            $text = htmlspecialchars(implode(' ', $cue['text']), ENT_QUOTES | ENT_XML1, 'UTF-8');
            $body .= sprintf(
                "      <p begin=\"%s\" end=\"%s\">%s</p>\n",
                $cue['start'],
                $cue['end'],
                $text
            );
        }

        return <<<TTML
        <?xml version="1.0" encoding="UTF-8"?>
        <tt xmlns="http://www.w3.org/ns/ttml">
          <body>
            <div>
        {$body}      </div>
          </body>
        </tt>
        TTML;
    }
}
