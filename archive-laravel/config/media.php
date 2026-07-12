<?php

return [
    'ffmpeg_path' => env('FFMPEG_PATH', 'ffmpeg'),
    'ffprobe_path' => env('FFPROBE_PATH', 'ffprobe'),
    'transcription_binary' => env('TRANSCRIPTION_BINARY', 'transcribe'),
    'processor' => env('MEDIA_PROCESSOR', 'fake'), // 'fake' or 'real'

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
