<?php

namespace App\Providers;

use App\Services\Ingest\FakeIngestTransport;
use App\Services\Ingest\FtpIngestTransport;
use App\Services\Ingest\IngestScanner;
use App\Services\Ingest\IngestTransport;
use App\Services\Ingest\PhpFtpClient;
use App\Services\Ingest\SmbIngestTransport;
use App\Services\Media\FakeMediaProcessor;
use App\Services\Media\FakeProcessRunner;
use App\Services\Media\MediaProcessor;
use App\Services\Media\ProcessRunner;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\SymfonyProcessRunner;
use App\Services\Media\WhisperTranscriber;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Process runner: real by default, fake in tests/offline mode
        $this->app->bind(ProcessRunner::class, fn () => new SymfonyProcessRunner());

        // Whisper transcriber: uses injected ProcessRunner for testability
        $this->app->bind(
            WhisperTranscriber::class,
            fn ($app) => new WhisperTranscriber(
                $app->make(ProcessRunner::class),
                config('media.whisper_binary'),
                config('media.whisper_model'),
                config('media.whisper_language'),
                config('media.whisper_output_format'),
                config('media.whisper_device'),
                config('media.whisper_compute_type'),
            )
        );

        // Media processor: fake by default (existing tests unaffected)
        // Set MEDIA_PROCESSOR=real to use ffmpeg-backed processor
        $processorType = config('media.processor');
        if ($processorType === 'real') {
            $this->app->bind(
                MediaProcessor::class,
                fn ($app) => new RealMediaProcessor(
                    $app->make(ProcessRunner::class),
                    $app->make(WhisperTranscriber::class),
                    config('media.ffmpeg_path'),
                    config('media.ffprobe_path'),
                )
            );
        } else {
            $this->app->bind(MediaProcessor::class, FakeMediaProcessor::class);
        }

        // Ingest transport: selection via env INGEST_TRANSPORT (fake|ftp|smb)
        // Default remains fake to preserve existing tests and offline mode
        $transportType = config('ingest.transport', 'fake');

        match ($transportType) {
            'ftp' => $this->app->bind(
                IngestTransport::class,
                fn () => new FtpIngestTransport(new PhpFtpClient())
            ),
            'smb' => $this->app->bind(
                IngestTransport::class,
                fn ($app) => new SmbIngestTransport($app->make(ProcessRunner::class))
            ),
            default => $this->app->bind(IngestTransport::class, FakeIngestTransport::class),
        };

        // Ingest scanner: wire disk and directory from config
        $this->app->bind(IngestScanner::class, fn () => new IngestScanner(
            config('ingest.disk'),
            config('ingest.directory'),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
