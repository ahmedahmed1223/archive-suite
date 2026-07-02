<?php

use App\Http\Middleware\AuditArchiveApiRequest;
use App\Http\Middleware\AuthenticateArchiveApiRequest;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Sentry\Laravel\Integration;

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
        $middleware->encryptCookies(except: [
            'va_refresh',
        ]);

        $middleware->alias([
            'archive.audit' => AuditArchiveApiRequest::class,
            'archive.auth' => AuthenticateArchiveApiRequest::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        Integration::handles($exceptions);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
