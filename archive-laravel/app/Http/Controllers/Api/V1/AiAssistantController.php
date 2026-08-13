<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Ai\Agents\ArchiveAssistantAgent;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AI-802/AI-804: the only entry point to ArchiveAssistantAgent. Read-only
 * by construction - see ArchiveAssistantAgent's tools(). Structured output
 * means `sources` is always present, even when empty.
 */
class AiAssistantController extends Controller
{
    public function ask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:4000'],
        ]);

        $user = $request->attributes->get('archive_user');
        if (! $user instanceof User) {
            return response()->json(['ok' => false, 'error' => 'Unauthenticated.'], 401);
        }

        $result = (new ArchiveAssistantAgent($user))->prompt($validated['message'])->toArray();

        return response()->json([
            'ok' => true,
            'answer' => $result['answer'] ?? null,
            'sources' => $result['sources'] ?? [],
        ]);
    }
}
