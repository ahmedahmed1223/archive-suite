<?php

declare(strict_types=1);

namespace App\Mcp\Tools;

use App\Http\Controllers\Api\V1\RecordsController;
use App\Mcp\Tools\Concerns\DelegatesToHttpController;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Tool;

#[Description("Read a single archive record's metadata by id. Read-only.")]
class GetRecordTool extends Tool
{
    use DelegatesToHttpController;

    public function handle(Request $request): Response|ResponseFactory
    {
        if ($rejected = $this->authorizeTool($request, 'get_record')) {
            return $rejected;
        }

        $args = $request->validate([
            'id' => ['required', 'string', 'max:200'],
            'store' => ['nullable', 'string', 'max:100'],
        ]);

        $result = $this->delegate(
            $request,
            RecordsController::class,
            'show',
            ['store' => $args['store'] ?? null],
            ['id' => $args['id']],
        );

        return Response::structured($result);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'id' => $schema->string()->description('The record uid or id.')->required(),
            'store' => $schema->string()->description('Storage bucket to search within, if known.'),
        ];
    }
}
