<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuditArchiveApiRequest
{
    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->isMethodSafe()) {
            $taxonomy = $this->classify($request, $response);

            AuditLog::query()->create([
                'action' => $request->method().' /'.$request->path(),
                'event' => $taxonomy['event'],
                'resource_type' => $taxonomy['resource_type'],
                'resource_id' => $taxonomy['resource_id'],
                'actor_id' => $request->attributes->get('archive_user')?->getKey(),
                'outcome' => $taxonomy['outcome'],
                'status_code' => $response->getStatusCode(),
                'metadata' => [
                    'route' => $request->route()?->uri(),
                    'query' => $request->query(),
                    'sessionId' => $request->attributes->get('archive_session')?->getKey(),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        }

        return $response;
    }

    /**
     * @return array{event: string, resource_type: string|null, resource_id: string|null, outcome: string}
     */
    private function classify(Request $request, Response $response): array
    {
        $method = $request->method();
        $route = $request->route()?->uri() ?? $request->path();
        $resourceId = null;

        [$event, $resourceType] = match ([$method, $route]) {
            ['POST', 'api/v1/records/bulk'] => ['records.bulk_upsert', 'record'],
            ['POST', 'api/v1/records/{id}/notes'] => ['record_notes.create', 'record_note'],
            ['PATCH', 'api/v1/record-notes/{id}'] => ['record_notes.update', 'record_note'],
            ['DELETE', 'api/v1/record-notes/{id}'] => ['record_notes.delete', 'record_note'],
            ['POST', 'api/v1/rights'] => ['rights.upsert', 'rights_record'],
            ['POST', 'api/v1/relations'] => ['relations.create', 'record_relation'],
            ['DELETE', 'api/v1/relations/{id}'] => ['relations.delete', 'record_relation'],
            ['POST', 'api/v1/share'] => ['share.create', 'share_link'],
            ['POST', 'api/v1/media/jobs'] => ['media.workflow.queue', 'media_job'],
            ['POST', 'api/v1/auth/logout'] => ['auth.logout', 'api_session'],
            default => [strtolower($method).'.'.str_replace('/', '.', trim($route, '/')), null],
        };

        if ($route === 'api/v1/rights' || $route === 'api/v1/media/jobs') {
            $resourceId = $request->string($route === 'api/v1/rights' ? 'itemId' : 'recordId')->toString() ?: null;
        }

        if ($route === 'api/v1/relations') {
            $resourceId = $request->string('sourceId')->toString() ?: null;
        }

        if ($route === 'api/v1/relations/{id}') {
            $resourceId = $request->route('id');
        }

        if (in_array($route, ['api/v1/records/{id}/notes', 'api/v1/record-notes/{id}'], true)) {
            $resourceId = $request->route('id');
        }

        if ($route === 'api/v1/auth/logout') {
            $resourceId = $request->attributes->get('archive_session')?->getKey();
        }

        return [
            'event' => $event,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'outcome' => $this->outcome($response),
        ];
    }

    private function outcome(Response $response): string
    {
        if ($response->isSuccessful()) {
            return 'success';
        }

        if ($response->isClientError()) {
            return 'rejected';
        }

        return 'failed';
    }
}
