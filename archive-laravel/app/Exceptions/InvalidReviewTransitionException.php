<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a review session state transition (start/request-changes/
 * approve/resume/close) is attempted from a state that does not allow it.
 * Callers map this to a 409 response.
 */
class InvalidReviewTransitionException extends RuntimeException {}
