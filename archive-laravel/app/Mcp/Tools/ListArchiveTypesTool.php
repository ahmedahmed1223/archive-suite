<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Controllers\Api\V1\TypesController;
use App\Mcp\Tools\Concerns\DelegatesToHttpController;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Tool;

#[Description('List the archive type definitions (video, document, ...) configured for this instance. Read-only.')]
class ListArchiveTypesTool extends Tool
{
    use DelegatesToHttpController;

    public function handle(Request $request): Response|ResponseFactory
    {
        if ($rejected = $this->authorizeTool($request, 'list_archive_types')) {
            return $rejected;
        }

        $args = $request->validate([
            'cursor' => ['nullable', 'string', 'max:500'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $result = $this->delegate($request, TypesController::class, 'index', $args);

        return Response::structured($result);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'cursor' => $schema->string()->description('Pagination cursor from a previous call.'),
            'limit' => $schema->integer()->description('Max results, 1-50 (default 50).'),
        ];
    }
}
