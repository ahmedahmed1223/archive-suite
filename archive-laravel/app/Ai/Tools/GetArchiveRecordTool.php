<?php

declare(strict_types=1);

namespace App\Ai\Tools;

use App\Ai\Tools\Concerns\DelegatesToHttpController;
use App\Http\Controllers\Api\V1\RecordsController;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;

/**
 * AI-802: read-only. Delegates to the same RecordsController the HTTP API
 * uses - this tool has no write counterpart, so the model structurally
 * cannot edit a record through the assistant.
 */
class GetArchiveRecordTool implements Tool
{
    use DelegatesToHttpController;

    public function __construct(private readonly User $user) {}

    public function description(): string
    {
        return "Read a single archive record's metadata by id. Read-only.";
    }

    public function handle(Request $request): string
    {
        $args = $request->all();
        $result = $this->delegate(
            $this->user,
            RecordsController::class,
            'show',
            ['store' => $args['store'] ?? null],
            ['id' => $args['id'] ?? null],
        );

        return json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
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
