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
];
