<?php

declare(strict_types=1);

namespace App\Ai\Agents;

use App\Ai\Tools\GetArchiveRecordTool;
use App\Ai\Tools\SearchArchiveRecordsTool;
use App\Models\User;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Promptable;

/**
 * AI-802: a read-only archive assistant. Its only tools search and read
 * records already visible to the calling user (see
 * App\Ai\Tools\Concerns\DelegatesToHttpController) - it has no create,
 * update, or delete tool, so it cannot mutate archive data no matter what
 * a prompt asks. Anything resembling an edit belongs to
 * create_review_request-style flows (see App\Mcp\Tools\CreateReviewRequestTool)
 * where a human explicitly approves the change; this agent is not wired to
 * any of those and never will be without that approval step (AI-803).
 */
class ArchiveAssistantAgent implements Agent, HasTools
{
    use Promptable;

    public function __construct(private readonly User $user) {}

    public function instructions(): string
    {
        return <<<'MARKDOWN'
            You are a read-only assistant for the Archive Suite. You can search
            and read archive records via your tools. You cannot create, edit,
            tag, or delete anything - you have no tool for it. If asked to make
            a change, explain that changes require a human to review and apply
            them through the archive UI. Cite record ids when referencing
            specific records.
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
}
