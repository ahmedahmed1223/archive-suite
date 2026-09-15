<?php

declare(strict_types=1);

namespace App\Services\Search;

use App\Models\MediaInspection;
use App\Models\TimedDescriptionSegment;

/**
 * V2-MEDIA-004: the matching moments inside one record.
 *
 * Two sources, and they differ in how trustworthy their time is:
 *
 * - Transcript cues carry an explicit timecode in the VTT/SRT itself, so their
 *   time is exact and needs no conversion.
 * - Description segments store frame numbers. Converting those to seconds needs
 *   the material's real frame rate. ffprobe already captures it as a rational
 *   ({numerator, denominator}) in the probe report, which is why 29.97 is kept
 *   as 30000/1001 instead of being rounded into drift.
 *
 * When no frame rate can be resolved the segment moment is still returned, but
 * WITHOUT a timestamp. A previous attempt at this feature assumed 25fps, which
 * silently placed 30fps material about 20% off while looking authoritative.
 * The acceptance criterion is that the result opens at the *correct* time, so a
 * moment whose time cannot be justified does not get one.
 */
class RecordMomentsService
{
    public function __construct(private readonly TranscriptSearchService $transcripts) {}

    /**
     * @return list<array{kind: string, excerpt: string, timestampSeconds: int|null}>
     */
    public function forRecord(string $store, string $uid, ?string $transcript, string $query, int $limit = 5): array
    {
        $moments = [];

        foreach ($this->transcripts->findAll((string) $transcript, $query, $limit) as $hit) {
            $moments[] = [
                'kind' => 'transcript',
                'excerpt' => $hit['excerpt'],
                'timestampSeconds' => $hit['timestampSeconds'],
            ];
        }

        $frameRate = $this->frameRate($store, $uid);

        foreach ($this->matchingSegments($uid, $query, $limit) as $segment) {
            $moments[] = [
                'kind' => 'description',
                'excerpt' => $segment->title,
                'timestampSeconds' => $frameRate === null
                    ? null
                    : (int) floor($segment->start_frame * $frameRate['denominator'] / $frameRate['numerator']),
            ];
        }

        usort($moments, static fn (array $a, array $b): int => ($a['timestampSeconds'] ?? PHP_INT_MAX) <=> ($b['timestampSeconds'] ?? PHP_INT_MAX));

        return $moments;
    }

    /** @return list<TimedDescriptionSegment> */
    private function matchingSegments(string $uid, string $query, int $limit): array
    {
        $needle = trim($query);

        if ($needle === '') {
            return [];
        }

        return TimedDescriptionSegment::query()
            ->where('record_id', $uid)
            ->where(function ($builder) use ($needle): void {
                $builder->where('title', 'like', '%'.$needle.'%')
                    ->orWhere('description', 'like', '%'.$needle.'%');
            })
            ->orderBy('start_frame')
            ->limit($limit)
            ->get()
            ->all();
    }

    /**
     * The rational frame rate of the record's video stream, from the most recent
     * probe inspection. Null when nothing has probed this material yet.
     *
     * @return array{numerator: int, denominator: int}|null
     */
    private function frameRate(string $store, string $uid): ?array
    {
        $inspection = MediaInspection::query()
            ->where('record_store', $store)
            ->where('record_uid', $uid)
            ->where('inspection_type', 'probe')
            ->latest('completed_at')
            ->first();

        $streams = $inspection?->report['streams'] ?? null;

        if (! is_array($streams)) {
            return null;
        }

        foreach ($streams as $stream) {
            $rate = is_array($stream) ? ($stream['frameRate'] ?? null) : null;
            $numerator = is_array($rate) ? (int) ($rate['numerator'] ?? 0) : 0;
            $denominator = is_array($rate) ? (int) ($rate['denominator'] ?? 0) : 0;

            if (($stream['type'] ?? null) === 'video' && $numerator > 0 && $denominator > 0) {
                return ['numerator' => $numerator, 'denominator' => $denominator];
            }
        }

        return null;
    }
}
