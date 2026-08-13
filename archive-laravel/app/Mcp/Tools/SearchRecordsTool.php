<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Controllers\Api\V1\SearchController;
use App\Mcp\Tools\Concerns\DelegatesToHttpController;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Tool;

#[Description('Search archive records by keyword, type, tag, or status. Read-only, bounded to `limit` results.')]
class SearchRecordsTool extends Tool
{
    use DelegatesToHttpController;

    public function handle(Request $request): Response|ResponseFactory
    {
        if ($rejected = $this->authorizeTool($request, 'search_records')) {
            return $rejected;
        }

        $args = $request->validate([
            'q' => ['nullable', 'string', 'max:500'],
            'store' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'max:100'],
            'tag' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:100'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $result = $this->delegate($request, SearchController::class, 'index', $args);

        return Response::structured($result);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'q' => $schema->string()->description('Free-text search query.'),
            'store' => $schema->string()->description('Limit to a single storage bucket, e.g. archive-items.'),
            'type' => $schema->string()->description('Filter by archive type.'),
            'tag' => $schema->string()->description('Filter by a single tag.'),
            'status' => $schema->string()->description('Filter by workflow status.'),
            'limit' => $schema->integer()->description('Max results, 1-50 (default 20).'),
        ];
    }
}
