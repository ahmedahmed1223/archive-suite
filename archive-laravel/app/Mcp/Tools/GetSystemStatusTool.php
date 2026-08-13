<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Controllers\Api\V1\SystemStatusController;
use App\Mcp\Tools\Concerns\DelegatesToHttpController;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Tool;

#[Description('Check system health: storage usage and disaster-recovery readiness. Admin-only, read-only.')]
class GetSystemStatusTool extends Tool
{
    use DelegatesToHttpController;

    public function handle(Request $request): Response|ResponseFactory
    {
        if ($rejected = $this->authorizeTool($request, 'get_system_status')) {
            return $rejected;
        }

        $result = $this->delegate($request, SystemStatusController::class, 'status');

        if (($result['ok'] ?? false) !== true) {
            return Response::error((string) ($result['error'] ?? 'Forbidden.'));
        }

        return Response::structured($result);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [];
    }
}
