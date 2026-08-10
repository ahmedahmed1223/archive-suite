<?php

use App\Http\Middleware\ApplyCspPolicy;
use App\Http\Middleware\AuditArchiveApiRequest;
use App\Http\Middleware\AuthenticateArchiveApiRequest;
use App\Http\Middleware\CorrelateRequest;
use App\Http\Middleware\FeatureGate;
use App\Http\Middleware\MarkSafetyPreviewResponse;
use App\Support\ApiError;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // Channel auth reuses the bearer/cookie session middleware (not the "web"
    // session guard) so the Next.js Echo client can authorize private
    // channels with its existing Authorization header.
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['prefix' => 'api/v1', 'middleware' => ['archive.auth']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(CorrelateRequest::class);
        // V2-402: makes the displayed-but-dead csp_policy setting real for
        // Laravel's own responses. See ApplyCspPolicy's docblock.
        $middleware->append(ApplyCspPolicy::class);
        $middleware->encryptCookies(except: [
            'va_refresh',
        ]);
        // V2-403: applies the 'api' RateLimiter defined in
        // AppServiceProvider::boot() (backed by SecuritySettingsService's
        // configurable perUserRateLimit) to every api/* route, not just the 8
        // routes that already had an explicit throttle:N,1 literal.
        $middleware->throttleApi();

        $middleware->alias([
            'archive.audit' => AuditArchiveApiRequest::class,
            'archive.auth' => AuthenticateArchiveApiRequest::class,
            'archive.feature' => FeatureGate::class,
            'safety-preview.response' => MarkSafetyPreviewResponse::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        // Central fallback for exceptions that escape controller code
        // uncaught (framework validation, routing 404s, throttling, and any
        // unhandled Throwable). Controllers that catch their own exceptions
        // and build a response via ApiError::envelope() never reach this.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return ApiError::renderException($e, $request);
        });
    })->create();
