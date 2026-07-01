<?php

return [
    'ffmpeg_path' => env('FFMPEG_PATH', 'ffmpeg'),
    'ffprobe_path' => env('FFPROBE_PATH', 'ffprobe'),
    'transcription_binary' => env('TRANSCRIPTION_BINARY', 'transcribe'),
    'processor' => env('MEDIA_PROCESSOR', 'fake'), // 'fake' or 'real'

    // Whisper transcription settings
    'whisper_binary' => env('WHISPER_BINARY', 'faster-whisper'),
    'whisper_model' => env('WHISPER_MODEL', 'large-v3'),
    'whisper_language' => env('WHISPER_LANGUAGE', 'ar'),
    'whisper_output_format' => env('WHISPER_OUTPUT_FORMAT', 'vtt'),
    'whisper_device' => env('WHISPER_DEVICE', 'cuda'),
    'whisper_compute_type' => env('WHISPER_COMPUTE_TYPE', 'float16'),
    // Speaker diarization via pyannote (whisper-ctranslate2 --diarize). Requires
    // a HuggingFace auth token (HF_TOKEN env var) with access to pyannote's
    // gated models; off by default since it needs that extra setup.
    'whisper_diarize' => env('WHISPER_DIARIZE', false),

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
