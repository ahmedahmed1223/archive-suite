<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a save or restore would overwrite a locked (approved/
 * certified) transcript version without the caller explicitly passing
 * unlock=true. Callers map this to a 409 response -- this is what keeps an
 * approved transcript from ever being silently overwritten.
 */
class TranscriptLockedException extends RuntimeException {}
