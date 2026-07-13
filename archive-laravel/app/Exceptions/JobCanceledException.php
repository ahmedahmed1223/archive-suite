<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a queued media job is found to be canceled (status flipped to
 * 'canceled' via the cancel API) either before processing starts or between
 * checkpoints while it runs. Callers must not treat this as a normal
 * failure: no retry, no "failed" status, no error message stored.
 */
class JobCanceledException extends RuntimeException
{
}
