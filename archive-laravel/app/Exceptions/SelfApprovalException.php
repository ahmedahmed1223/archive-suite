<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown by App\Support\SelfApprovalGuard when a submitter/requester tries
 * to act as an approver on their own request. Callers map this to a 403.
 */
class SelfApprovalException extends RuntimeException {}
