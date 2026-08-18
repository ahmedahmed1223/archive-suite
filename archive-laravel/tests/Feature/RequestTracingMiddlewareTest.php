<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Middleware\CorrelateRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Mockery;
use Tests\TestCase;

/**
 * V3-PERF-002: CorrelateRequest is the Next.js <-> Laravel correlation
 * boundary (see docs/local-observability.md) plus the source of the
 * sanitized slow_request event. Exercised directly against the middleware
 * rather than through the full HTTP kernel so duration can be forced
 * deterministically via the configurable threshold instead of a real sleep.
 */
class RequestTracingMiddlewareTest extends TestCase
{
    public function test_a_missing_request_id_is_generated_and_returned_in_the_response(): void
    {
        $request = Request::create('/api/v1/health', 'GET');

        $response = (new CorrelateRequest)->handle($request, fn (Request $r) => new Response('ok'));

        $this->assertNotEmpty($response->headers->get('X-Request-ID'));
    }

    public function test_a_valid_incoming_request_id_is_echoed_back_unchanged(): void
    {
        $request = Request::create('/api/v1/health', 'GET');
        $request->headers->set('X-Request-Id', 'client-supplied-id-123');

        $response = (new CorrelateRequest)->handle($request, fn (Request $r) => new Response('ok'));

        $this->assertSame('client-supplied-id-123', $response->headers->get('X-Request-ID'));
    }

    public function test_an_invalid_incoming_request_id_is_replaced_with_a_generated_one(): void
    {
        $request = Request::create('/api/v1/health', 'GET');
        $request->headers->set('X-Request-Id', "not valid; ' OR 1=1 --");

        $response = (new CorrelateRequest)->handle($request, fn (Request $r) => new Response('ok'));

        $this->assertNotSame("not valid; ' OR 1=1 --", $response->headers->get('X-Request-ID'));
        $this->assertNotEmpty($response->headers->get('X-Request-ID'));
    }

    public function test_a_request_at_or_over_the_configured_threshold_logs_a_sanitized_slow_request_event(): void
    {
        config(['observability.slow_request_threshold_ms' => 0]);
        Log::spy();

        $request = Request::create('/api/v1/records?token=super-secret&password=hunter2', 'POST', [
            'password' => 'hunter2',
            'apiKey' => 'sk-leak',
            'filePath' => '/var/www/archive-laravel/storage/app/archive-files/record-1/source.mov',
        ]);
        $request->headers->set('Authorization', 'Bearer leaked-token');
        $request->headers->set('X-Request-Id', 'slow-req-1');

        (new CorrelateRequest)->handle($request, fn (Request $r) => new Response('created', 201));

        $captured = null;
        Log::shouldHaveReceived('warning')->once()->withArgs(function (string $message, array $context) use (&$captured): bool {
            $captured = [$message, $context];

            return true;
        });

        [$message, $context] = $captured;
        $this->assertSame('slow_request', $message);
        $this->assertSame(['request_id', 'method', 'route', 'status', 'duration_ms', 'timestamp'], array_keys($context));
        $this->assertSame('slow-req-1', $context['request_id']);
        $this->assertSame('POST', $context['method']);
        $this->assertSame(201, $context['status']);
        $this->assertIsInt($context['duration_ms']);
        $this->assertGreaterThanOrEqual(0, $context['duration_ms']);

        // Sanitization: only the allowlisted keys above ever reach the log,
        // so no serialization of the context can contain the request body,
        // auth header, query string, or a filesystem path.
        $serialized = json_encode($context, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('hunter2', $serialized);
        $this->assertStringNotContainsString('sk-leak', $serialized);
        $this->assertStringNotContainsString('leaked-token', $serialized);
        $this->assertStringNotContainsString('super-secret', $serialized);
        $this->assertStringNotContainsString('/var/www', $serialized);
        $this->assertStringNotContainsString('archive-files', $serialized);
    }

    public function test_a_request_under_the_configured_threshold_is_not_logged_as_slow(): void
    {
        config(['observability.slow_request_threshold_ms' => 60_000]);
        Log::spy();

        $request = Request::create('/api/v1/health', 'GET');

        (new CorrelateRequest)->handle($request, fn (Request $r) => new Response('ok'));

        Log::shouldNotHaveReceived('warning', ['slow_request', Mockery::type('array')]);
    }
}
