<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * RT-802: thrown by CudaCapabilityChecker::assertAvailable() instead of a
 * generic RuntimeException, so ProcessMediaWorkflow's catch block can tell a
 * GPU resource failure apart from any other job failure (bad input, ffmpeg
 * error, etc.) and broadcast it as a queue-status resource failure instead
 * of just a per-job error.
 */
class GpuUnavailableException extends RuntimeException {}
