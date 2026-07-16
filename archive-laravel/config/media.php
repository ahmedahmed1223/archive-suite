<?php

return [
    'ffmpeg_path' => env('FFMPEG_PATH', 'ffmpeg'),
    'ffprobe_path' => env('FFPROBE_PATH', 'ffprobe'),
    'transcription_binary' => env('TRANSCRIPTION_BINARY', 'transcribe'),
    'processor' => env('MEDIA_PROCESSOR', 'fake'), // 'fake' or 'real'

    // ProcessMediaWorkflow queue behaviour (V1-113). Timeout is generous
    // because transcription of long recordings can legitimately take
    // several minutes; tries+backoff only help with transient failures
    // (disk hiccup, OCR service blip) — a deterministic failure (bad file,
    // missing binary) will fail identically on every attempt.
    'job_timeout_seconds' => (int) env('MEDIA_JOB_TIMEOUT_SECONDS', 900),
    // External media tools must be allowed to run at least as long as the
    // queue job itself; keeping this configurable avoids a hidden 5-minute
    // cap inside the Symfony process wrapper.
    'process_timeout_seconds' => (int) env('MEDIA_PROCESS_TIMEOUT_SECONDS', 900),
    'job_tries' => (int) env('MEDIA_JOB_TRIES', 3),
    'job_backoff_seconds' => [30, 120, 300],
    // How long a dispatched job's uniqueId lock is held (ShouldBeUnique) so a
    // duplicate dispatch() for the same media_jobs.id while one is still
    // queued/running is dropped instead of double-processed.
    'job_unique_for_seconds' => (int) env('MEDIA_JOB_UNIQUE_FOR_SECONDS', 3600),
    // V1-123: media:prune-jobs deletes terminal (completed/failed/canceled)
    // media_jobs rows once completed_at is older than this. queued/processing
    // rows are never touched regardless of age.
    'job_retention_days' => (int) env('MEDIA_JOB_RETENTION_DAYS', 90),

    // Base URL of the ocr-service microservice (infra/ocr-service);
    // POST {base}/ocr, multipart file upload, returns { text, lines, lang }.
    // Port 8788 matches main.py's PORT default / the service's Dockerfile EXPOSE.
    'ocr_service_url' => env('OCR_SERVICE_URL', 'http://ocr:8788'),

    // Whisper transcription settings
    'whisper_binary' => env('WHISPER_BINARY', 'whisper-ctranslate2'),
    'whisper_model' => env('WHISPER_MODEL', 'large-v3'),
    'whisper_language' => env('WHISPER_LANGUAGE', 'ar'),
    'whisper_output_format' => env('WHISPER_OUTPUT_FORMAT', 'vtt'),
    'whisper_device' => env('WHISPER_DEVICE', 'cpu'),
    'whisper_compute_type' => env('WHISPER_COMPUTE_TYPE', 'int8'),
    // Speaker diarization via pyannote. whisper-ctranslate2 has no --diarize
    // switch — passing a non-empty --hf_token is what turns it on, so
    // whisper_diarize just gates whether we forward HF_TOKEN at all. Requires
    // a HuggingFace auth token with access to pyannote's gated models; off by
    // default since it needs that extra setup.
    'whisper_diarize' => env('WHISPER_DIARIZE', false),
    'whisper_hf_token' => env('HF_TOKEN', ''),

    // Optional ffmpeg overlay for transcode jobs. Per-job options.watermark can
    // override these values, and options.watermark.enabled=false disables it.
    'watermark' => [
        'enabled' => env('MEDIA_WATERMARK_ENABLED', false),
        'path' => env('MEDIA_WATERMARK_PATH'),
        'position' => env('MEDIA_WATERMARK_POSITION', 'bottom-right'),
        'opacity' => env('MEDIA_WATERMARK_OPACITY', 0.85),
        'margin' => env('MEDIA_WATERMARK_MARGIN', 24),
    ],
];
