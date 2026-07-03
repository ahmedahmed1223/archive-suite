<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserInvitation;
use App\Support\ApiToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class InvitationsController extends Controller
{
    public function accept(Request $request, string $token): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $invitation = UserInvitation::query()
            ->where('token_hash', ApiToken::hash($token))
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->first();

        if (! $invitation) {
            return response()->json(['ok' => false, 'error' => 'Invalid or expired invitation.'], 404);
        }

        $user = User::query()->create([
            'name' => $validated['name'],
            'email' => $invitation->email,
            'password' => Hash::make($validated['password']),
            'role' => $invitation->role,
        ]);

        $invitation->update(['accepted_at' => now()]);

        return response()->json(['ok' => true, 'user' => [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ]], 201);
    }
}
