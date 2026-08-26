<?php

namespace App\Domain\Montage;

use App\Models\MontageProjectRevision;

/**
 * Pure timeline validation. No I/O, no Eloquent — takes a payload array and
 * either accepts it or throws a MontageValidationException listing every
 * offending field, so controllers can translate it to a 422 verbatim.
 */
class MontageTimelineValidator
{
    /** Presets are allowlisted server-side; the client never names codecs. */
    public const EXPORT_PRESETS = ['web-1080p', 'web-4k', 'archive-master'];

    public function assertValid(array $payload): void
    {
        $errors = [];

        $tracks = $payload['tracks'] ?? [];
        if (! is_array($tracks)) {
            $errors['tracks'] = 'Tracks must be an array.';
        }

        $trackIds = [];
        foreach ($tracks as $i => $track) {
            $id = $track['id'] ?? null;
            if (! is_string($id) || $id === '') {
                $errors["tracks.$i.id"] = 'Every track needs a non-empty string id.';
            } elseif (in_array($id, $trackIds, true)) {
                $errors["tracks.$i.id"] = "Duplicate track id '$id'.";
            } else {
                $trackIds[] = $id;
            }
        }

        foreach ($payload['clips'] ?? [] as $i => $clip) {
            foreach (['id', 'trackId', 'timelineStart', 'sourceIn', 'sourceOut'] as $field) {
                if (! isset($clip[$field])) {
                    $errors["clips.$i.$field"] = "Missing required field '$field'.";
                }
            }
            if (isset($clip['sourceOut'], $clip['sourceIn'])
                && $clip['sourceOut'] <= $clip['sourceIn']) {
                $errors["clips.$i.sourceOut"] = 'sourceOut must be greater than sourceIn.';
            }
            if (isset($clip['timelineStart']) && $clip['timelineStart'] < 0) {
                $errors["clips.$i.timelineStart"] = 'timelineStart cannot be negative.';
            }
            $token = $clip['source']['sourceVersionToken'] ?? null;
            if (! is_string($token) || $token === '') {
                $errors["clips.$i.source.sourceVersionToken"] = 'Every clip pins a source version token.';
            }
            $trackId = $clip['trackId'] ?? null;
            if ($trackId !== null && ! in_array($trackId, $trackIds, true)) {
                $errors["clips.$i.trackId"] = "Clip references unknown track '$trackId'.";
            }
        }

        if ($errors !== []) {
            throw new MontageValidationException($errors);
        }
    }

    /**
     * Derive the pinned source-version token for a revision: the first clip's
     * token when present, so exports can verify media has not changed.
     */
    public function deriveSourceVersionToken(array $clips): ?string
    {
        foreach ($clips as $clip) {
            $token = $clip['source']['sourceVersionToken'] ?? null;
            if (is_string($token) && $token !== '') {
                return $token;
            }
        }

        return null;
    }
}
