<?php

namespace App\Providers;

use App\Services\Ingest\FakeIngestTransport;
use App\Services\Ingest\IngestScanner;
use App\Services\Ingest\IngestTransport;
use App\Services\Media\FakeMediaProcessor;
use App\Services\Media\FakeProcessRunner;
use App\Services\Media\MediaProcessor;
use App\Services\Media\ProcessRunner;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\SymfonyProcessRunner;
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

        // Media processor: fake by default (existing tests unaffected)
        // Set MEDIA_PROCESSOR=real to use ffmpeg-backed processor
        $processorType = config('media.processor');
        if ($processorType === 'real') {
            $this->app->bind(
                MediaProcessor::class,
                fn ($app) => new RealMediaProcessor(
                    $app->make(ProcessRunner::class),
                    config('media.ffmpeg_path'),
                    config('media.ffprobe_path'),
                    config('media.transcription_binary'),
                )
            );
        } else {
            $this->app->bind(MediaProcessor::class, FakeMediaProcessor::class);
        }

        // Ingest transport: fake by default (for testing; real FTP/SMB deferred)
        $this->app->bind(IngestTransport::class, FakeIngestTransport::class);

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
