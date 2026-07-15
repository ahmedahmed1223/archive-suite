<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AuditArchiveApiRequest
{
    /**
     * @param Closure(Request): Response $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $recordBefore = $this->recordBefore($request);
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
                'metadata' => $this->metadata($request, $taxonomy, $recordBefore),
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
            ['POST', 'api/v1/records/{id}/comments'] => ['record_comments.create', 'record_comment'],
            ['DELETE', 'api/v1/record-comments/{id}'] => ['record_comments.delete', 'record_comment'],
            ['POST', 'api/v1/rights'] => ['rights.upsert', 'rights_record'],
            ['POST', 'api/v1/relations'] => ['relations.create', 'record_relation'],
            ['DELETE', 'api/v1/relations/{id}'] => ['relations.delete', 'record_relation'],
            ['POST', 'api/v1/share'] => ['share.create', 'share_link'],
            ['POST', 'api/v1/media/jobs'] => ['media.workflow.queue', 'media_job'],
            ['POST', 'api/v1/auth/logout'] => ['auth.logout', 'api_session'],
            ['POST', 'api/v1/system/control/{action}'] => [
                $response->getStatusCode() === 503 ? 'system_control.blocked' : ($response->isSuccessful() ? 'system_control.allowed' : 'system_control.rejected'),
                'system_control_action',
            ],
            default => [strtolower($method).'.'.str_replace('/', '.', trim($route, '/')), null],
        };

        if ($route === 'api/v1/rights' || $route === 'api/v1/media/jobs') {
            $resourceId = $request->string($route === 'api/v1/rights' ? 'itemId' : 'recordId')->toString() ?: null;
        }

        if ($route === 'api/v1/records/bulk') {
            $records = $request->input('records');
            if (is_array($records) && count($records) === 1 && is_array($records[0] ?? null)) {
                $resourceId = $records[0]['uid'] ?? $records[0]['id'] ?? null;
            }
        }

        if ($route === 'api/v1/relations') {
            $resourceId = $request->string('sourceId')->toString() ?: null;
        }

        if ($route === 'api/v1/relations/{id}') {
            $resourceId = $request->route('id');
        }

        if (in_array($route, [
            'api/v1/records/{id}/notes',
            'api/v1/record-notes/{id}',
            'api/v1/records/{id}/comments',
            'api/v1/record-comments/{id}',
        ], true)) {
            $resourceId = $request->route('id');
        }

        if ($route === 'api/v1/auth/logout') {
            $resourceId = $request->attributes->get('archive_session')?->getKey();
        }

        if ($route === 'api/v1/system/control/{action}') {
            $resourceId = $request->route('action');
        }

        $outcome = $route === 'api/v1/system/control/{action}' && $response->getStatusCode() === 503
            ? 'rejected'
            : $this->outcome($response);

        return [
            'event' => $event,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'outcome' => $outcome,
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

    /**
     * @param array{event: string, resource_type: string|null, resource_id: string|null, outcome: string} $taxonomy
     * @return array<string, mixed>
     */
    private function metadata(Request $request, array $taxonomy, ?array $recordBefore = null): array
    {
        $payload = $this->redact($request->except(['password', 'password_confirmation']));
        $metadata = [
            'route' => $request->route()?->uri(),
            'query' => $this->redact($request->query()),
            'sessionId' => $request->attributes->get('archive_session')?->getKey(),
            'restoreDecision' => $this->restoreDecision($request, $taxonomy),
        ];

        if ($payload !== []) {
            $metadata['request'] = $payload;
            $metadata['diff'] = [
                'kind' => $request->isMethod('delete') ? 'delete-request' : 'requested-change',
                'fields' => $this->fieldPaths($payload),
                'after' => $payload,
            ];

            $recordDiff = $this->recordDiff($request, $taxonomy, $recordBefore);
            if ($recordDiff !== null) {
                $metadata['diff'] = [...$metadata['diff'], ...$recordDiff];
            }
        }

        return $metadata;
    }

    /** @return array<string, mixed>|null */
    private function recordBefore(Request $request): ?array
    {
        if (! $request->isMethod('post') || $request->route()?->uri() !== 'api/v1/records/bulk') return null;

        $records = $request->input('records');
        if (! is_array($records) || count($records) !== 1 || ! is_array($records[0] ?? null)) return null;

        $id = $records[0]['uid'] ?? $records[0]['id'] ?? null;
        if (! is_string($id) || $id === '') return null;

        $row = DB::table('storage_rows')
            ->where('store', (string) ($request->input('store') ?: 'archive-items'))
            ->where(function ($query) use ($id): void {
                $query->where('uid', $id)->orWhere('data->>\'id\'', $id);
            })
            ->first();
        $data = $row?->data ? json_decode((string) $row->data, true) : null;

        return is_array($data) ? $data : null;
    }

    /**
     * @param array{event: string, resource_type: string|null, resource_id: string|null, outcome: string} $taxonomy
     * @param array<string, mixed>|null $recordBefore
     * @return array{before: array<string, mixed>, after: array<string, mixed>, fields: array<int, string>}|null
     */
    private function recordDiff(Request $request, array $taxonomy, ?array $recordBefore): ?array
    {
        if ($taxonomy['event'] !== 'records.bulk_upsert' || $taxonomy['outcome'] !== 'success' || $recordBefore === null) return null;

        $records = $request->input('records');
        $record = is_array($records) && is_array($records[0] ?? null) ? $records[0] : null;
        if ($record === null) return null;

        $before = [];
        $after = [];
        foreach ($this->redact($record) as $field => $value) {
            if ($this->isSensitiveKey((string) $field)) {
                continue;
            }

            $previous = $this->redact([$field => $recordBefore[$field] ?? null])[$field];
            if ($previous !== $value) {
                $before[$field] = $previous;
                $after[$field] = $value;
            }
        }

        return $after === [] ? null : ['before' => $before, 'after' => $after, 'fields' => array_keys($after)];
    }

    private function isSensitiveKey(string $key): bool
    {
        return preg_match('/password|token|secret|key|dsn|credential|authorization/', strtolower($key)) === 1;
    }

    /**
     * @param array{event: string, resource_type: string|null, resource_id: string|null, outcome: string} $taxonomy
     * @return array<string, mixed>
     */
    private function restoreDecision(Request $request, array $taxonomy): array
    {
        if ($request->isMethod('delete')) {
            return [
                'available' => false,
                'label' => 'استعادة يدوية فقط',
                'reason' => 'حدث حذف أو إلغاء يتطلب مراجعة السجل الأصلي أو نسخة احتياطية قبل الاستعادة.',
            ];
        }

        if ($taxonomy['event'] === 'records.bulk_upsert') {
            return [
                'available' => true,
                'label' => 'قابل للمراجعة من payload',
                'reason' => 'يمكن مراجعة payload المنقح أدناه قبل قرار إعادة تطبيقه أو عكسه يدوياً.',
            ];
        }

        if (str_contains($taxonomy['event'], '.update') || str_contains($taxonomy['event'], '.upsert')) {
            return [
                'available' => true,
                'label' => 'راجع diff قبل الاستعادة',
                'reason' => 'التغيير موثق كطلب منقح. لا تنفذ استعادة إلا بعد مطابقة السجل الحالي.',
            ];
        }

        return [
            'available' => false,
            'label' => 'لا يوجد إجراء استعادة آلي',
            'reason' => 'هذا الحدث موثق للمراجعة ولا يحتوي snapshot كافياً لعكسه تلقائياً.',
        ];
    }

    /**
     * @param array<string, mixed> $value
     * @return array<string, mixed>
     */
    private function redact(array $value): array
    {
        $redacted = [];

        foreach ($value as $key => $item) {
            $normalizedKey = strtolower((string) $key);
            if ($this->isSensitiveKey($normalizedKey)) {
                $redacted[$key] = '[redacted]';
                continue;
            }

            if (is_array($item)) {
                $redacted[$key] = $this->redact(array_slice($item, 0, 50, true));
                continue;
            }

            if ($item instanceof \Illuminate\Http\UploadedFile) {
                $redacted[$key] = [
                    'name' => $item->getClientOriginalName(),
                    'size' => $item->getSize(),
                    'mimeType' => $item->getClientMimeType(),
                ];
                continue;
            }

            if (is_object($item)) {
                $redacted[$key] = '[object '.class_basename($item).']';
                continue;
            }

            if (is_string($item) && strlen($item) > 500) {
                $redacted[$key] = substr($item, 0, 500).'...';
                continue;
            }

            $redacted[$key] = $item;
        }

        return $redacted;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<int, string>
     */
    private function fieldPaths(array $payload, string $prefix = ''): array
    {
        $paths = [];

        foreach ($payload as $key => $value) {
            $path = $prefix === '' ? (string) $key : $prefix.'.'.$key;
            if (is_array($value)) {
                array_push($paths, ...$this->fieldPaths($value, $path));
            } else {
                $paths[] = $path;
            }
        }

        return array_slice(array_values(array_unique($paths)), 0, 50);
    }
}
