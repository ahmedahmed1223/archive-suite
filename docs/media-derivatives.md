# Media job queue and derivatives

[العربية](media-derivatives.ar.md) · [Documentation](README.md)

Every media operation — thumbnail, transcode, transcription, OCR, montage
export, and derivative generation — runs as a `MediaJob` on a Laravel queue
worker. This page covers queue behavior, backpressure, and how retry and
cancellation work; see [Whisper transcription](whisper.md) for
transcription-specific configuration.

## Queue and backpressure

Jobs run on the `default` queue, except transcription jobs when the system
Whisper device is set to `cuda`, which route to the separate `gpu` queue and
its dedicated worker. Derivative generation and every other operation always
use `default` — there is no GPU-accelerated path for thumbnails, waveforms,
or proxies today.

To keep a queue from growing without bound, a new job is rejected with
`429 Too Many Requests` (and a `Retry-After: 30` header) once its queue
already has `MEDIA_MAX_QUEUED_JOBS_PER_QUEUE` (default 50) jobs queued or
processing. Retry the request after the indicated wait rather than
resubmitting immediately.

| Setting | Effect | Default |
| --- | --- | --- |
| `MEDIA_MAX_QUEUED_JOBS_PER_QUEUE` | Jobs allowed in a queue before new dispatches are rejected | 50 |
| `MEDIA_JOB_TIMEOUT_SECONDS` | Maximum time a job may run before Laravel's queue worker times it out | 900 |
| `MEDIA_PROCESS_TIMEOUT_SECONDS` | Maximum time the underlying `ffmpeg`/transcription process may run | 900 |
| `MEDIA_JOB_TRIES` | Automatic retry attempts for a failed job | 3 |
| — | Delay before each automatic retry | 30s, then 120s, then 300s |
| `MEDIA_JOB_UNIQUE_FOR_SECONDS` | How long a duplicate dispatch for the same job id is dropped instead of double-processed | 3600 |
| `MEDIA_JOB_RETENTION_DAYS` | Age after which a completed, failed, or canceled job row is pruned. Jobs still queued or processing are never pruned regardless of age. | 90 |

Automatic retries only help with transient failures (a disk hiccup, a brief
OCR service outage); a deterministic failure — a corrupt file, a missing
binary — fails identically on every attempt.

## Derivative types

A derivative is one of `thumbnail`, `waveform`, or `proxy`. It is cached by
the exact combination of record, attachment, derivative type, source
version, and generation settings: requesting a derivative that is already
ready or already in flight for that exact combination returns the existing
one instead of starting duplicate work. Requesting a derivative again after
a previous attempt failed resets it and dispatches a fresh job automatically
— there is no separate manual retry action.

## Cancel and retry

Any job still `queued` or `processing` can be canceled; a job that already
`completed`, `failed`, or was already `canceled` cannot be canceled again.
Canceling stops it from being treated as in-progress but does not remove its
history. To retry a failed job's *work*, resubmit the same operation (for a
derivative, request it again with the same parameters); the queue does not
automatically restart a canceled or failed job's original submission.

## GPU routing

Only transcription honors the GPU queue, and only when the system's Whisper
device is `cuda` and the GPU worker (`laravel-worker-gpu`) is running — see
[Whisper transcription](whisper.md#gpu-operation). If `cuda` is selected
without a healthy GPU worker, the job fails with an operational error rather
than silently falling back to CPU. Thumbnail, transcode, OCR, montage
export, and derivative jobs are not GPU-accelerated and always run on the
CPU worker.
