<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Ai\Agents\ArchiveAssistantAgent;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AI-802: the only entry point to ArchiveAssistantAgent. Read-only by
 * construction - see ArchiveAssistantAgent's tools().
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

        $response = (new ArchiveAssistantAgent($user))->prompt($validated['message']);

        return response()->json(['ok' => true, 'text' => $response->text]);
    }
}
