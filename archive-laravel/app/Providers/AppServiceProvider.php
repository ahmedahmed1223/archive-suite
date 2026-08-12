<?php

namespace App\Providers;

use App\Services\Dropbox\DropboxConnectionService;
use App\Services\Dropbox\DropboxGateway;
use App\Services\Dropbox\DropboxIngestTransport;
use App\Services\Ingest\FakeIngestTransport;
use App\Services\Ingest\FtpIngestTransport;
use App\Services\Ingest\IngestScanner;
use App\Services\Ingest\IngestTransport;
use App\Services\Ingest\PhpFtpClient;
use App\Services\Ingest\SmbIngestTransport;
use App\Services\Media\FakeMediaProcessor;
use App\Services\Media\CudaCapabilityChecker;
use App\Services\Media\LocalMediaJobExecutor;
use App\Services\Media\MediaJobExecutor;
use App\Services\Media\MediaJobProgressBroadcaster;
use App\Services\Media\MediaProcessor;
use App\Services\Media\OcrClient;
use App\Services\Media\ProcessRunner;
use App\Services\Media\RealMediaProcessor;
use App\Services\Media\SymfonyProcessRunner;
use App\Services\Media\WhisperTranscriber;
use App\Services\Odbc\NativeOdbcConnectionFactory;
use App\Services\Odbc\OdbcConnectionFactory;
use App\Services\Odbc\OdbcConnectionProbe;
use App\Services\Security\SecuritySettingsService;
use AzureOss\Storage\Blob\BlobServiceClient;
use AzureOss\Storage\BlobFlysystem\AzureBlobStorageAdapter;
use Google\Cloud\Storage\StorageClient;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use League\Flysystem\Filesystem;
use League\Flysystem\GoogleCloudStorage\GoogleCloudStorageAdapter;
use Spatie\Dropbox\Client as DropboxClient;
use Spatie\FlysystemDropbox\DropboxAdapter;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Process runner: real by default, fake in tests/offline mode
        $this->app->bind(
            ProcessRunner::class,
            fn () => new SymfonyProcessRunner(config('media.process_timeout_seconds')),
        );

        $this->app->bind(
            OdbcConnectionFactory::class,
            fn () => new NativeOdbcConnectionFactory(config('odbc.dialect', 'sqlserver')),
        );
        $this->app->bind(
            OdbcConnectionProbe::class,
            fn ($app) => new OdbcConnectionProbe(
                $app->make(OdbcConnectionFactory::class),
                config('odbc', []),
            )
        );

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
                config('media.whisper_diarize'),
                config('media.whisper_hf_token'),
                null,
                $app->make(SecuritySettingsService::class),
                new CudaCapabilityChecker($app->make(ProcessRunner::class)),
            )
        );

        $this->app->bind(
            OcrClient::class,
            fn () => new OcrClient(config('media.ocr_service_url'))
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
                    config('media.watermark', []),
                    $app->make(OcrClient::class),
                    null,
                    null,
                    $app->make(MediaJobProgressBroadcaster::class),
                )
            );
        } else {
            $this->app->bind(MediaProcessor::class, FakeMediaProcessor::class);
        }

        // This binding is the process boundary seam for V1-786. Production
        // deployments can replace it with a remote CPU/GPU executor while
        // ProcessMediaWorkflow remains the sole owner of job state and audit.
        $this->app->bind(
            MediaJobExecutor::class,
            fn ($app) => new LocalMediaJobExecutor(
                $app->make(MediaProcessor::class),
                config('media.executor', 'local-v1'),
            ),
        );

        // Ingest transport: selection via env INGEST_TRANSPORT (fake|ftp|smb|dropbox)
        // Default remains fake to preserve existing tests and offline mode
        $transportType = config('ingest.transport', 'fake');

        match ($transportType) {
            'ftp' => $this->app->bind(
                IngestTransport::class,
                fn () => new FtpIngestTransport(new PhpFtpClient)
            ),
            'smb' => $this->app->bind(
                IngestTransport::class,
                fn ($app) => new SmbIngestTransport($app->make(ProcessRunner::class))
            ),
            'dropbox' => $this->app->bind(
                IngestTransport::class,
                fn ($app) => new DropboxIngestTransport(
                    $app->make(DropboxConnectionService::class),
                    $app->make(DropboxGateway::class),
                )
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
        $this->assertSecureCookiesInProduction();

        // Cloud storage drivers not shipped with Laravel core. Clients are
        // built lazily inside each closure so no network/credential work
        // happens at boot when a driver is unconfigured or unused.
        Storage::extend('azure', function ($app, array $config) {
            $client = BlobServiceClient::fromConnectionString($config['connection_string'] ?? '');
            $container = $client->getContainerClient($config['container'] ?? '');
            $adapter = new AzureBlobStorageAdapter($container, $config['prefix'] ?? '');

            return new FilesystemAdapter(new Filesystem($adapter, $config), $adapter, $config);
        });

        Storage::extend('gcs', function ($app, array $config) {
            $clientConfig = ['projectId' => $config['project_id'] ?? null];
            if (! empty($config['key_file'])) {
                $clientConfig['keyFilePath'] = $config['key_file'];
            }

            $bucket = (new StorageClient($clientConfig))->bucket($config['bucket'] ?? '');

            $adapter = new GoogleCloudStorageAdapter($bucket, $config['prefix'] ?? '');

            return new FilesystemAdapter(new Filesystem($adapter, $config), $adapter, $config);
        });

        Storage::extend('dropbox', function ($app, array $config) {
            $client = new DropboxClient($config['token'] ?? null);

            $adapter = new DropboxAdapter($client, $config['prefix'] ?? '');

            return new FilesystemAdapter(new Filesystem($adapter, $config), $adapter, $config);
        });

        // V2-403: SecuritySettingsService::getSettings()['perUserRateLimit'] was
        // exposed and updatable but no RateLimiter definition ever read it, so
        // only the 8 routes with an explicit throttle:N,1 middleware literal had
        // any cap. This ties a real 'api' limiter to the configured/overridable
        // value and applies it globally via $middleware->throttleApi() in
        // bootstrap/app.php. Disabled under testing: the suite fires far more
        // than any sane per-minute cap through the same test client IP within a
        // single fast run, which isn't the traffic pattern the limit exists for.
        RateLimiter::for('api', function (Request $request) {
            if ($this->app->environment('testing')) {
                return Limit::none();
            }

            $perMinute = max(1, (int) $this->app->make(SecuritySettingsService::class)
                ->getSettings()['perUserRateLimit']);

            return Limit::perMinute($perMinute)->by($request->user()?->id ?? $request->ip());
        });
    }

    /**
     * V1-101: refuse to boot in production with an insecure refresh cookie.
     *
     * ponytail: only guards the auth-critical `va_refresh` cookie flag
     * (config('archive.auth.secure_cookies'), consumed in
     * AuthController::refreshCookie()) — not SESSION_SECURE_COOKIE, which
     * isn't wired to anything auth-critical here.
     */
    private function assertSecureCookiesInProduction(): void
    {
        // composer's post-autoload-dump hook runs this during the Docker image
        // build, before any real .env/APP_ENV exists — config's env() fallback
        // resolves to "production" there even though it isn't a real deploy.
        if ($this->app->runningConsoleCommand('package:discover')) {
            return;
        }

        if (! $this->app->environment('production')) {
            return;
        }

        $host = parse_url((string) config('app.url'), PHP_URL_HOST);
        $loopbackHttp = in_array($host, ['localhost', '127.0.0.1', '::1'], true)
            && str_starts_with((string) config('app.url'), 'http://');

        if (! config('archive.auth.secure_cookies') && ! $loopbackHttp) {
            throw new \RuntimeException(
                'ARCHIVE_SECURE_COOKIES must be true in production. Set ARCHIVE_SECURE_COOKIES=true '
                .'so the va_refresh auth cookie is only sent over HTTPS.'
            );
        }
    }
}
