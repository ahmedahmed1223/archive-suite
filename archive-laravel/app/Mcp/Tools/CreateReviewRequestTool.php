<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Controllers\Api\V1\RecordFieldRequestController;
use App\Mcp\Tools\Concerns\DelegatesToHttpController;
use App\Models\AuditLog;
use App\Support\AuditRedactor;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Tool;

/**
 * MCP-804: this never writes the record itself — it files a
 * record_field_requests row (the same draft-review queue humans already use
 * via POST /api/v1/records/{id}/field-requests) for a person to resolve. No
 * MCP tool in this server can apply the change directly.
 */
#[Description('Draft a proposed change to a record for human review. Does NOT apply the change — files a review request a person must resolve.')]
class CreateReviewRequestTool extends Tool
{
    use DelegatesToHttpController;

    public function handle(Request $request): Response|ResponseFactory
    {
        if ($rejected = $this->authorizeTool($request, 'create_review_request', true)) {
            return $rejected;
        }

        $args = $request->validate([
            'recordId' => ['required', 'string', 'max:200'],
            'field' => ['required', 'string', 'max:100'],
            'message' => ['required', 'string', 'min:1', 'max:2000'],
            'assignee' => ['nullable', 'string', 'max:200'],
            'dueDate' => ['nullable', 'date'],
            'departmentId' => ['nullable', 'string', 'max:100'],
        ]);

        $startedAt = hrtime(true);

        $result = $this->delegate(
            $request,
            RecordFieldRequestController::class,
            'store',
            [
                'field' => $args['field'],
                'message' => $args['message'],
                'assignee' => $args['assignee'] ?? null,
                'dueDate' => $args['dueDate'] ?? null,
                'departmentId' => $args['departmentId'] ?? null,
            ],
            ['recordId' => $args['recordId']],
        );

        $ok = ($result['ok'] ?? false) === true;
        $durationMs = (int) round((hrtime(true) - $startedAt) / 1_000_000);

        AuditLog::query()->create([
            'action' => 'mcp.tool.create_review_request',
            'event' => 'mcp_review_request.create',
            'resource_type' => 'record_field_request',
            'resource_id' => $result['request']['id'] ?? null,
            'actor_id' => $request->user()?->getKey(),
            'outcome' => $ok ? 'success' : 'rejected',
            'status_code' => $ok ? 201 : 422,
            'metadata' => [
                'tool' => 'create_review_request',
                'mcpSessionId' => $request->sessionId(),
                'durationMs' => $durationMs,
                'args' => AuditRedactor::redact($args),
            ],
            'ip_address' => null,
            'user_agent' => null,
        ]);

        if (! $ok) {
            return Response::error((string) ($result['error'] ?? 'Could not create the review request.'));
        }

        return Response::structured($result);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'recordId' => $schema->string()->description('The record uid or id this request is about.')->required(),
            'field' => $schema->string()->description('The field the change applies to.')->required(),
            'message' => $schema->string()->description('What should change and why.')->required(),
            'assignee' => $schema->string()->description('Who should review this, if known.'),
            'dueDate' => $schema->string()->description('ISO date the review is needed by.'),
            'departmentId' => $schema->string()->description('Routes to that department field owner when assignee is omitted.'),
        ];
    }
}
