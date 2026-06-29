<?php

return [
    'ffmpeg_path' => env('FFMPEG_PATH', 'ffmpeg'),
    'ffprobe_path' => env('FFPROBE_PATH', 'ffprobe'),
    'transcription_binary' => env('TRANSCRIPTION_BINARY', 'transcribe'),
    'processor' => env('MEDIA_PROCESSOR', 'fake'), // 'fake' or 'real'
];
