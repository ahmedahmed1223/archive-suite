<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Stable machine-readable error codes for the {ok:false, error, code}
 * envelope. `error` stays human text — ~50 Next pages already match on it
 * verbatim and existing PHPUnit tests assert on it, so it is never removed
 * or reworded here. `code` is what new UI logic should branch on instead of
 * fragile string matching (see the 3 sentinel pages this replaced).
 */
final class ApiError
{
    public const UNAUTHENTICATED = 'UNAUTHENTICATED';

    public const FORBIDDEN = 'FORBIDDEN';

    public const NOT_FOUND = 'NOT_FOUND';

    public const VALIDATION_FAILED = 'VALIDATION_FAILED';

    public const RATE_LIMITED = 'RATE_LIMITED';

    public const FEATURE_DISABLED = 'FEATURE_DISABLED';

    public const SYSTEM_CONTROL_DISABLED = 'SYSTEM_CONTROL_DISABLED';

    public const SERVER_ERROR = 'SERVER_ERROR';

    /**
     * Build the envelope for a manually-thrown JSON error response. Pass an
     * explicit $code when the status code alone is ambiguous (e.g. a 503
     * that means something more specific than "feature disabled").
     *
     * @return array{ok: false, error: string, code: string}
     */
    public static function envelope(string $error, int $status, ?string $code = null): array
    {
        return ['ok' => false, 'error' => $error, 'code' => $code ?? self::defaultCodeForStatus($status)];
    }

    public static function defaultCodeForStatus(int $status): string
    {
        return match ($status) {
            401 => self::UNAUTHENTICATED,
            403 => self::FORBIDDEN,
            404 => self::NOT_FOUND,
            422 => self::VALIDATION_FAILED,
            429 => self::RATE_LIMITED,
            503 => self::FEATURE_DISABLED,
            default => self::SERVER_ERROR,
        };
    }

    /**
     * Central fallback renderer for exceptions that escape controller code
     * uncaught (framework validation, routing 404s, throttling, and any
     * unhandled Throwable). Controllers that already catch their own
     * exceptions and build a response via envelope() never reach this path.
     */
    public static function renderException(Throwable $e, Request $request): JsonResponse
    {
        $status = self::statusForException($e);
        $code = self::defaultCodeForStatus($status);

        $payload = self::envelope(self::messageForException($e, $status), $status, $code);

        if ($e instanceof ValidationException) {
            $payload['errors'] = $e->errors();
        }

        $headers = $e instanceof HttpExceptionInterface ? $e->getHeaders() : [];

        return response()->json($payload, $status, $headers);
    }

    private static function statusForException(Throwable $e): int
    {
        return match (true) {
            $e instanceof ValidationException => $e->status,
            $e instanceof HttpExceptionInterface => $e->getStatusCode(),
            default => 500,
        };
    }

    private static function messageForException(Throwable $e, int $status): string
    {
        if ($status === 500) {
            // ponytail: never leak internals in prod; keep the real message
            // in dev/test/staging where it helps debugging.
            return app()->isProduction() ? 'Server error.' : $e->getMessage();
        }

        $message = $e->getMessage();

        return $message !== '' ? $message : self::genericMessageForStatus($status);
    }

    private static function genericMessageForStatus(int $status): string
    {
        return match ($status) {
            401 => 'Unauthorized.',
            403 => 'Forbidden.',
            404 => 'Not found.',
            422 => 'Validation failed.',
            429 => 'Too many requests.',
            default => 'Request failed.',
        };
    }
}
