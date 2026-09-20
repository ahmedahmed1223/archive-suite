<?php

declare(strict_types=1);

namespace App\Services\Media;

use App\Jobs\ProcessMediaWorkflow;
use App\Models\MediaJob;
use App\Support\RequestCorrelation;
use Illuminate\Support\Str;

/**
 * Queues the baseline derivative needed after an accepted media ingest while
 * preserving the same version-pinned MediaDerivative identity as manual
 * derivative requests.
 */
final class IngestDerivativeService
{
    /** @var list<string> */
    private const VIDEO_EXTENSIONS = [
        'mp4', 'mov', 'mxf', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'ts', 'm2ts', 'mts', 'dv',
    ];

    /** @var list<string> */
    private const AUDIO_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac'];

    public function __construct(
        private readonly MediaDerivativeService $derivatives,
        private readonly MediaJobExecutor $executor,
        private readonly MediaJobProgressBroadcaster $progress,
    ) {}

    public function queueBaseline(string $recordId, string $sourcePath, string $fileName): void
    {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $type = in_array($extension, self::VIDEO_EXTENSIONS, true)
            ? 'proxy'
            : (in_array($extension, self::AUDIO_EXTENSIONS, true) ? 'waveform' : null);
        if ($type === null) {
            return;
        }

        $found = $this->derivatives->findOrBuildPending($recordId, null, null, $type, [], null);
        if (! $found['isNew']) {
            return;
        }

        $mediaJob = MediaJob::query()->create([
            'id' => (string) Str::uuid(),
            'record_id' => $recordId,
            'operation' => 'derivative',
            'status' => 'queued',
            'queue' => 'default',
            'executor' => $this->executor->name(),
            'contract_version' => (int) config('media.job_contract_version', 1),
            'source_path' => $sourcePath,
            'options' => [
                'derivativeId' => $found['derivative']->id,
                'derivativeType' => $type,
                'settings' => $found['derivative']->settings,
            ],
            'queued_at' => now(),
        ]);

        $this->derivatives->attachJob($found['derivative'], $mediaJob);
        ProcessMediaWorkflow::dispatch($mediaJob->id, RequestCorrelation::id())->onQueue('default');
        $this->progress->notify($mediaJob);
    }
}
