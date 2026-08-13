<?php

declare(strict_types=1);

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

/**
 * AI-803: proposes a summary/tags/type/subtype for a record's current
 * text - never writes anything itself. The caller (RecordAiSuggestionController)
 * saves the output as a pending draft; nothing is applied to the record
 * until a human approves it through the review endpoints.
 */
class RecordSuggestionAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'MARKDOWN'
            You suggest archive record metadata from the text you are given.
            Propose a concise summary, relevant tags, and (if evident from the
            text) a type and subtype. This is a draft for a human to review -
            never claim it has been applied.
            MARKDOWN;
    }

    /**
     * @return array<string, mixed>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'summary' => $schema->string()->description('A concise 1-3 sentence summary.')->required(),
            'tags' => $schema->array($schema->string())->description('Relevant tags, most relevant first.')->required(),
            'type' => $schema->string()->description('Archive type, e.g. video, audio, document - only if evident.'),
            'subtype' => $schema->string()->description('Archive subtype, e.g. interview, raw - only if evident.'),
        ];
    }
}
