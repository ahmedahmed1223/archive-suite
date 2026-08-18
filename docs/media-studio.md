# Media studio

[العربية](media-studio.ar.md) · [Documentation](README.md)

The media studio (**Media → Studio**, opened from a record's attachment) is
the unified workspace for reviewing and refining a record's audio or video:
the player and transcript, timeline comments, a transcript editor, version
comparison, cached derivatives, and external review links.

## Player and transcript

The player supports space to play or pause and the left/right arrow keys to
seek five seconds, as long as focus is not in a text field or on a button.
The transcript panel lists cues from the record's transcript; selecting a
line jumps the player to that point, and the active cue highlights as
playback reaches it.

## Timeline comments

The side panel lists comments placed at a point on the timeline, each typed
as an issue, a suggestion, a highlight, or a chapter marker. Comments update
live for everyone viewing the same record when the realtime service is
configured; without it, or if the connection drops, the panel polls for
updates every 8 seconds so the list never goes stale for long.

## Transcript editing and versions

Open **Transcriber** (`/transcriber`) to edit cue text and timing directly,
add or remove cues, and export as SRT or VTT. Saving validates that cues are
not inverted, out of order, or overlapping before it writes a new version.
Locking a version prevents further edits until it is explicitly unlocked;
saving over a locked version asks for confirmation first. Every save creates
a version you can restore later.

## Version compare

Open **Media → Compare** with a record selected (`?recordId=`) to play two
versions of the same record's media side by side with optional synced
playback, and to build a non-destructive clip list from either version.
Opening Compare without a record falls back to its original manual two-path
comparison tool for any two file paths.

## Derivatives

A derivative is a cached, lightweight copy of a record's media — a
thumbnail, a waveform, or a proxy (a smaller preview copy) — generated for a
specific version and settings combination and reused until the source
changes. See [media job queue and derivatives](media-derivatives.md) for how
generation, retries, and cancellation work.

## External review links

A token-gated public link (`/review/<token>`) lets someone outside the
organization view a record's media and, if the link allows it, leave
approve/request-changes decisions without signing in. A link is view-only or
comment-enabled, optionally allows download, and expires automatically —
after 7 days by default when no explicit expiry is set. An optional visible
watermark label displays over the media in the public viewer as a reminder
that the copy is under review; it is a viewer overlay, not a mark burned
into the video or image itself, so a downloaded or re-recorded copy will not
carry it. Creating a link is an editor or administrator action performed
through the API; the public viewer page itself needs no sign-in.
