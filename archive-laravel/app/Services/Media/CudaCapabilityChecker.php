<?php

namespace App\Services\Media;

use App\Exceptions\GpuUnavailableException;

class CudaCapabilityChecker
{
    public function __construct(private readonly ProcessRunner $runner) {}

    /**
     * Fail closed when a CUDA job reaches a worker without the NVIDIA runtime.
     */
    public function assertAvailable(): void
    {
        $result = $this->runner->run([
            'nvidia-smi',
            '--query-gpu=name',
            '--format=csv,noheader',
        ]);

        if ($result['exitCode'] !== 0 || trim($result['stdout']) === '') {
            throw new GpuUnavailableException(
                'CUDA transcription requires a GPU worker with the NVIDIA runtime and a visible GPU. '
                .'Deploy laravel-worker-gpu with NVIDIA Container Toolkit, then retry the job.'
            );
        }
    }
}
