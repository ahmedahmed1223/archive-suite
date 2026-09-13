<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Services\Dropbox\DropboxConnectionService;
use App\Services\Security\SecuritySettingsService;
use App\Services\Settings\CapabilitySettingsService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Independent status of each media-operations toolchain component (ffmpeg,
 * ffprobe, whisper, reverb, gpu, connectors), for the "مركز عمليات الوسائط"
 * status panel (.stitch/SYSTEM_COVERAGE.md's "لم يُنفَّذ بعد" gap): before
 * this, the only signal available was the queued/gpu queue-depth summary and
 * the transcription device, with no per-tool availability read.
 *
 * Every status is derived from existing configuration/services -- the only
 * subprocess calls made are short, argument-free version/capability probes
 * of paths that already come from server config (never from the request),
 * and their result is cached briefly so a burst of panel loads doesn't
 * shell out repeatedly.
 */
class MediaToolchainStatusService
{
    public const STATUS_AVAILABLE = 'available';

    public const STATUS_NEEDS_CONFIGURATION = 'needs_configuration';

    public const STATUS_STOPPED = 'stopped';

    /** Keeps a burst of panel loads/poll refreshes from re-running probes on every request. */
    private const CACHE_TTL_SECONDS = 60;

    private const CACHE_KEY = 'media-toolchain-status:v1';

    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly CapabilitySettingsService $capabilitySettings,
        private readonly SecuritySettingsService $securitySettings,
        private readonly DropboxConnectionService $dropbox,
    ) {}

    /**
     * @return array{checkedAt: string, components: array<int, array{key: string, status: string, detail: string, configHint: ?string}>}
     */
    public function status(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL_SECONDS, function (): array {
            return [
                'checkedAt' => now()->toIso8601String(),
                'components' => [
                    $this->ffmpegStatus(),
                    $this->ffprobeStatus(),
                    $this->whisperStatus(),
                    $this->reverbStatus(),
                    $this->gpuStatus(),
                    $this->connectorsStatus(),
                ],
            ];
        });
    }

    /** @return array{key: string, status: string, detail: string, configHint: ?string} */
    private function ffmpegStatus(): array
    {
        if (! $this->capabilitySettings->isEnabled('mediaProcessing')) {
            return $this->component(
                'ffmpeg',
                self::STATUS_NEEDS_CONFIGURATION,
                'المعالج الحقيقي للوسائط غير مُفعّل؛ ffmpeg لا يُستخدم إلا عند تفعيل معالجة الوسائط الحقيقية.',
                'فعّل MEDIA_PROCESSOR=real في إعدادات النشر.',
            );
        }

        return $this->probeBinaryStatus('ffmpeg', (string) config('media.ffmpeg_path', 'ffmpeg'), ['-version']);
    }

    /** @return array{key: string, status: string, detail: string, configHint: ?string} */
    private function ffprobeStatus(): array
    {
        if (! $this->capabilitySettings->isEnabled('mediaProcessing')) {
            return $this->component(
                'ffprobe',
                self::STATUS_NEEDS_CONFIGURATION,
                'المعالج الحقيقي للوسائط غير مُفعّل؛ ffprobe لا يُستخدم إلا عند تفعيل معالجة الوسائط الحقيقية.',
                'فعّل MEDIA_PROCESSOR=real في إعدادات النشر.',
            );
        }

        return $this->probeBinaryStatus('ffprobe', (string) config('media.ffprobe_path', 'ffprobe'), ['-version']);
    }

    /** @return array{key: string, status: string, detail: string, configHint: ?string} */
    private function whisperStatus(): array
    {
        if (! $this->capabilitySettings->isEnabled('mediaProcessing')) {
            return $this->component(
                'whisper',
                self::STATUS_NEEDS_CONFIGURATION,
                'التفريغ النصي يتطلب تفعيل معالجة الوسائط الحقيقية أولًا.',
                'فعّل MEDIA_PROCESSOR=real في إعدادات النشر.',
            );
        }

        return $this->probeBinaryStatus('whisper', (string) config('media.whisper_binary', 'whisper-ctranslate2'), ['--help']);
    }

    /** @return array{key: string, status: string, detail: string, configHint: ?string} */
    private function reverbStatus(): array
    {
        $driver = (string) config('broadcasting.default', 'log');

        if ($driver !== 'reverb') {
            return $this->component(
                'reverb',
                self::STATUS_STOPPED,
                "بث Reverb غير مُستخدَم حاليًا (مُشغّل البث الحالي: {$driver}).",
                'اضبط BROADCAST_CONNECTION=reverb لتفعيل التحديثات المباشرة.',
            );
        }

        $key = (string) config('broadcasting.connections.reverb.key', '');
        $secret = (string) config('broadcasting.connections.reverb.secret', '');
        $appId = (string) config('broadcasting.connections.reverb.app_id', '');

        if (trim($key) === '' || trim($secret) === '' || trim($appId) === '') {
            return $this->component(
                'reverb',
                self::STATUS_NEEDS_CONFIGURATION,
                'مُشغّل البث مضبوط على Reverb لكن بيانات اعتماد التطبيق غير مكتملة.',
                'اضبط REVERB_APP_KEY وREVERB_APP_SECRET وREVERB_APP_ID.',
            );
        }

        return $this->component('reverb', self::STATUS_AVAILABLE, 'Reverb مُهيأ ويُستخدم كمُشغّل البث الافتراضي.');
    }

    /** @return array{key: string, status: string, detail: string, configHint: ?string} */
    private function gpuStatus(): array
    {
        $device = (string) ($this->securitySettings->getSettings()['whisperDevice'] ?? 'cpu');

        if ($device !== 'cuda') {
            return $this->component(
                'gpu',
                self::STATUS_STOPPED,
                'تسريع الرسوميات (GPU) متوقف؛ التفريغ النصي يعمل حاليًا على المعالج المركزي (CPU).',
                'فعّل جهاز CUDA من إعدادات الأمان (whisperDevice) على عامل مزوّد بكرت رسوميات.',
            );
        }

        try {
            $result = $this->runner->run(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader']);
        } catch (Throwable $exception) {
            Log::warning('Media toolchain status: GPU probe failed to run.', ['exception' => $exception::class]);

            return $this->component(
                'gpu',
                self::STATUS_NEEDS_CONFIGURATION,
                'تعذّر تنفيذ فحص كرت الرسوميات (nvidia-smi) على هذا الخادم.',
                'انشر عامل معالجة مزوّدًا بـ NVIDIA Container Toolkit (laravel-worker-gpu).',
            );
        }

        if ($result['exitCode'] !== 0 || trim($result['stdout']) === '') {
            return $this->component(
                'gpu',
                self::STATUS_NEEDS_CONFIGURATION,
                'جهاز التفريغ مضبوط على CUDA لكن لا يوجد كرت رسوميات ظاهر على هذا العامل.',
                'انشر عامل معالجة مزوّدًا بـ NVIDIA Container Toolkit (laravel-worker-gpu).',
            );
        }

        return $this->component('gpu', self::STATUS_AVAILABLE, 'كرت الرسوميات ('.trim($result['stdout']).') متاح لتسريع التفريغ النصي.');
    }

    /** @return array{key: string, status: string, detail: string, configHint: ?string} */
    private function connectorsStatus(): array
    {
        $transport = (string) config('ingest.transport', 'fake');

        return match ($transport) {
            'ftp' => $this->connectorStatusFor(
                'connectors',
                filled(config('ingest.ftp.host')) && filled(config('ingest.ftp.user')) && filled(config('ingest.ftp.password')),
                'موصل FTP مضبوط ومستخدم لاستقبال الوسائط.',
                'أضف FTP_HOST وFTP_USERNAME وFTP_PASSWORD.',
            ),
            'smb' => $this->connectorStatusFor(
                'connectors',
                filled(config('ingest.smb.host')) && filled(config('ingest.smb.share')) && filled(config('ingest.smb.user')),
                'موصل SMB مضبوط ومستخدم لاستقبال الوسائط.',
                'أضف SMB_HOST وSMB_SHARE وSMB_USER.',
            ),
            'dropbox' => $this->connectorStatusFor(
                'connectors',
                $this->dropbox->configured(),
                'موصل Dropbox مضبوط ومستخدم لاستقبال الوسائط.',
                'أضف بيانات اعتماد Dropbox (DROPBOX_CLIENT_ID وDROPBOX_CLIENT_SECRET).',
            ),
            default => $this->component(
                'connectors',
                self::STATUS_NEEDS_CONFIGURATION,
                'ناقل الاستقبال الحالي محاكى (fake)؛ لم يُضبط أي موصل خارجي حقيقي (FTP/SMB/Dropbox).',
                'اضبط INGEST_TRANSPORT إلى ftp أو smb أو dropbox مع بياناته.',
            ),
        };
    }

    private function connectorStatusFor(string $key, bool $configured, string $availableDetail, string $configHint): array
    {
        return $configured
            ? $this->component($key, self::STATUS_AVAILABLE, $availableDetail)
            : $this->component($key, self::STATUS_NEEDS_CONFIGURATION, 'موصل الاستقبال مُختار لكن بياناته غير مكتملة.', $configHint);
    }

    /**
     * Cheap, bounded, argument-free capability probe of a server-configured
     * binary path -- never built from request input. `-version`/`--help`
     * return almost immediately and never load a model, so this stays well
     * inside the ProcessRunner's request-path budget.
     */
    private function probeBinaryStatus(string $key, string $binaryPath, array $probeArgs): array
    {
        try {
            $result = $this->runner->run([$binaryPath, ...$probeArgs]);
        } catch (Throwable $exception) {
            Log::warning('Media toolchain status: binary probe failed to run.', [
                'component' => $key,
                'exception' => $exception::class,
            ]);

            return $this->component(
                $key,
                self::STATUS_STOPPED,
                "تعذّر تنفيذ {$binaryPath} على هذا الخادم.",
                "تحقّق من تثبيت {$key} وأن المسار المضبوط صحيح.",
            );
        }

        if ($result['exitCode'] !== 0) {
            return $this->component(
                $key,
                self::STATUS_STOPPED,
                "{$binaryPath} غير قابل للتنفيذ على هذا الخادم (رمز الخروج {$result['exitCode']}).",
                "تحقّق من تثبيت {$key} وأن المسار المضبوط صحيح.",
            );
        }

        return $this->component($key, self::STATUS_AVAILABLE, "{$binaryPath} مثبّت ومتاح على هذا الخادم.");
    }

    /** @return array{key: string, status: string, detail: string, configHint: ?string} */
    private function component(string $key, string $status, string $detail, ?string $configHint = null): array
    {
        return ['key' => $key, 'status' => $status, 'detail' => $detail, 'configHint' => $configHint];
    }
}
