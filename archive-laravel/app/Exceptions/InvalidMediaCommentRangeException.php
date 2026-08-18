<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a media review comment's start/end timestamps are invalid --
 * end before/equal to start, or either value beyond the media's known
 * duration. Callers map this to a 422 response.
 */
class InvalidMediaCommentRangeException extends RuntimeException {}
