<?php

declare(strict_types=1);

namespace App\Ai\Tools;

use App\Ai\Tools\Concerns\DelegatesToHttpController;
use App\Http\Controllers\Api\V1\SearchController;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;

/**
 * AI-802: read-only. Delegates to the same SearchController the HTTP API
 * uses, so results are exactly what the calling user could already see in
 * the archive UI - nothing new exposed via the agent.
 */
class SearchArchiveRecordsTool implements Tool
{
    use DelegatesToHttpController;

    public function __construct(private readonly User $user) {}

    public function description(): string
    {
        return 'Search archive records by keyword, type, tag, or status. Read-only, bounded to `limit` results.';
    }

    public function handle(Request $request): string
    {
        $args = $request->all();
        $result = $this->delegate($this->user, SearchController::class, 'index', [
            'q' => $args['query'] ?? null,
            'store' => $args['store'] ?? null,
            'type' => $args['type'] ?? null,
            'tag' => $args['tag'] ?? null,
            'status' => $args['status'] ?? null,
            'limit' => $args['limit'] ?? 10,
        ]);

        return json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'query' => $schema->string()->description('Free-text search query.'),
            'store' => $schema->string()->description('Limit to a single storage bucket, e.g. archive-items.'),
            'type' => $schema->string()->description('Filter by archive type.'),
            'tag' => $schema->string()->description('Filter by a single tag.'),
            'status' => $schema->string()->description('Filter by workflow status.'),
            'limit' => $schema->integer()->description('Max results, 1-50.')->default(10)->minimum(1)->maximum(50),
        ];
    }
}
