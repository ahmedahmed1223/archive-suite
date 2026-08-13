<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Ai\Agents\ArchiveAssistantAgent;
use App\Ai\AiUsageGovernor;
use App\Ai\AiUsageLimitExceeded;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AI-802/AI-804: the only entry point to ArchiveAssistantAgent. Read-only
 * by construction - see ArchiveAssistantAgent's tools(). Structured output
 * means `sources` is always present, even when empty.
 */
class AiAssistantController extends Controller
{
    public function __construct(private readonly AiUsageGovernor $usageGovernor) {}

    public function ask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:4000'],
            'departmentId' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->attributes->get('archive_user');
        if (! $user instanceof User) {
            return response()->json(['ok' => false, 'error' => 'Unauthenticated.'], 401);
        }

        $departmentId = $validated['departmentId'] ?? null;
        try {
            $this->usageGovernor->reserve($user, $departmentId, $validated['message']);
        } catch (AiUsageLimitExceeded $exception) {
            return response()->json(ApiError::envelope($exception->getMessage(), 429), 429);
        }

        try {
            $result = (new ArchiveAssistantAgent($user))->prompt(
                $validated['message'],
                provider: config('ai.governance.failover'),
                timeout: 30,
            )->toArray();
        } catch (\Throwable) {
            return response()->json(ApiError::envelope('AI assistant is temporarily unavailable.', 503, 'AI_PROVIDER_UNAVAILABLE'), 503);
        }

        $this->usageGovernor->recordCompleted($user, $departmentId, $validated['message'], $result);

        return response()->json([
            'ok' => true,
            'answer' => $result['answer'] ?? null,
            'sources' => $result['sources'] ?? [],
        ]);
    }
}
