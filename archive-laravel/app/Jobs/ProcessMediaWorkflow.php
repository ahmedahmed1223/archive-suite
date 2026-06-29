<?php

namespace App\Jobs;

use App\Models\MediaJob;
use App\Services\Media\MediaProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessMediaWorkflow implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $mediaJobId)
    {
    }

    public function handle(MediaProcessor $processor): void
    {
        $mediaJob = MediaJob::query()->find($this->mediaJobId);

        if (! $mediaJob) {
            return;
        }

        $mediaJob->forceFill([
            'status' => 'processing',
            'started_at' => now(),
            'error' => null,
        ])->save();

        try {
            $artifacts = $processor->process($mediaJob);

            $mediaJob->forceFill([
                'status' => 'completed',
                'result' => [
                    'operation' => $mediaJob->operation,
                    'recordId' => $mediaJob->record_id,
                    'artifacts' => $artifacts,
                ],
                'completed_at' => now(),
            ])->save();
        } catch (Throwable $error) {
            $mediaJob->forceFill([
                'status' => 'failed',
                'error' => $error->getMessage(),
                'completed_at' => now(),
            ])->save();

            throw $error;
        }
    }
}
