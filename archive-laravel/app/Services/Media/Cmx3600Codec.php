<?php

declare(strict_types=1);

namespace App\Services\Media;

/** Narrow, side-effect-free CMX 3600 preview parser for straight video cuts. */
final class Cmx3600Codec
{
    /** @return array{accepted: list<array<string,string>>, rejected: list<array<string,string>>} */
    public function preview(string $edl): array
    {
        $accepted = [];
        $rejected = [];
        foreach (preg_split('/\R/', $edl) ?: [] as $lineNumber => $line) {
            if (trim($line) === '' || str_starts_with(trim($line), 'TITLE:')) {
                continue;
            }
            if (! preg_match('/^\s*(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d\d:\d\d:\d\d:\d\d)\s+(\d\d:\d\d:\d\d:\d\d)\s+(\d\d:\d\d:\d\d:\d\d)\s+(\d\d:\d\d:\d\d:\d\d)/', $line, $m)) {
                $rejected[] = ['line' => (string) ($lineNumber + 1), 'reason' => 'invalid_cmx_event'];

                continue;
            }
            [, $event, $reel, $track, $transition, $sourceIn, $sourceOut, $recordIn, $recordOut] = $m;
            if ($track !== 'V') {
                $rejected[] = ['line' => (string) ($lineNumber + 1), 'reason' => 'audio_track_unsupported'];

                continue;
            }
            if ($transition !== 'C') {
                $rejected[] = ['line' => (string) ($lineNumber + 1), 'reason' => 'transition_unsupported'];

                continue;
            }
            $accepted[] = compact('event', 'reel', 'sourceIn', 'sourceOut', 'recordIn', 'recordOut');
        }

        return compact('accepted', 'rejected');
    }
}
