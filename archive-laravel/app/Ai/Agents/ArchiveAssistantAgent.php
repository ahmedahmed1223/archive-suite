<?php

declare(strict_types=1);

namespace App\Ai\Agents;

use App\Ai\Tools\GetArchiveRecordTool;
use App\Ai\Tools\SearchArchiveRecordsTool;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Promptable;

/**
 * AI-802/AI-804: a read-only, source-citing archive assistant. Its only
 * tools search (keyword or semantic - AI-804 reuses the existing pgvector
 * RAG path, see SearchArchiveRecordsTool) and read records already
 * visible to the calling user (see
 * App\Ai\Tools\Concerns\DelegatesToHttpController) - it has no create,
 * update, or delete tool, so it cannot mutate archive data no matter what
 * a prompt asks. Anything resembling an edit belongs to
 * create_review_request-style flows (see App\Mcp\Tools\CreateReviewRequestTool,
 * App\Ai\Agents\RecordSuggestionAgent) where a human explicitly approves the
 * change; this agent is not wired to any of those and never will be
 * without that approval step. Structured output makes "sources" an
 * explicit, machine-readable list rather than trusting inline prose
 * citations.
 */
class ArchiveAssistantAgent implements Agent, HasStructuredOutput, HasTools
{
    use Promptable;

    public function __construct(private readonly User $user) {}

    public function instructions(): string
    {
        return <<<'MARKDOWN'
            You are a read-only assistant for the Archive Suite. You can search
            (keyword or semantic) and read archive records via your tools. You
            cannot create, edit, tag, or delete anything - you have no tool for
            it. If asked to make a change, explain that changes require a human
            to review and apply them through the archive UI. List every record
            you actually relied on in `sources` - never cite a record you did
            not look up via a tool call. If nothing relevant was found, say so
            in `answer` and leave `sources` empty.
            MARKDOWN;
    }

    /**
     * @return iterable<int, Tool>
     */
    public function tools(): iterable
    {
        return [
            new SearchArchiveRecordsTool($this->user),
            new GetArchiveRecordTool($this->user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'answer' => $schema->string()->description('The answer to the question, in prose.')->required(),
            'sources' => $schema->array($schema->object([
                'recordId' => $schema->string()->required(),
                'title' => $schema->string()->required(),
            ]))->description('Records actually looked up via tools and relied on for the answer.')->required(),
        ];
    }
}
