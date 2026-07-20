<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a ScheduledUpload state transition fails due to a stale
 * version number or an illegal transition.
 */
class ScheduledUploadConflict extends RuntimeException {}
