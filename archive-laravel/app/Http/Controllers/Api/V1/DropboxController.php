<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Dropbox\DropboxConnectionService;
use App\Services\Dropbox\DropboxGateway;
use App\Services\Dropbox\DropboxSyncService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DropboxController extends Controller
{
    public function authorize(Request $request, DropboxConnectionService $dropbox): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;
        if (! $dropbox->configured()) return response()->json(['ok' => false, 'error' => 'Dropbox OAuth is not configured.'], 409);
        $state = Str::random(64); $verifier = Str::random(96); $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
        /** @var \App\Models\User $user */
        $user = $request->attributes->get('archive_user');
        Cache::put('dropbox.oauth.'.$state, ['user_id' => $user->id, 'verifier' => $verifier], now()->addMinutes(10));
        $query = http_build_query(['client_id' => config('services.dropbox.client_id'), 'response_type' => 'code', 'redirect_uri' => config('services.dropbox.redirect_uri'), 'state' => $state, 'code_challenge' => $challenge, 'code_challenge_method' => 'S256']);
        return response()->json(['ok' => true, 'authorizationUrl' => 'https://www.dropbox.com/oauth2/authorize?'.$query]);
    }

    public function callback(Request $request, DropboxConnectionService $dropbox, DropboxGateway $gateway): JsonResponse
    {
        $data = $request->validate(['state' => ['required', 'string'], 'code' => ['required', 'string'], 'folderPath' => ['nullable', 'string', 'max:1024']]);
        $pending = Cache::pull('dropbox.oauth.'.$data['state']);
        if (! is_array($pending) || ! isset($pending['user_id'], $pending['verifier'])) return response()->json(['ok' => false, 'error' => 'Invalid or expired OAuth state.'], 422);
        $user = \App\Models\User::find($pending['user_id']);
        if (! $user) return response()->json(['ok' => false, 'error' => 'OAuth user is unavailable.'], 422);
        try {
            $token = $gateway->exchangeAuthorizationCode($data['code'], $pending['verifier']);
            $expiresAt = isset($token['expires_in']) ? now()->addSeconds((int) $token['expires_in'])->toIso8601String() : null;
            return response()->json(['ok' => true, 'dropbox' => $dropbox->connect($user, $token['access_token'], $token['refresh_token'] ?? null, $data['folderPath'] ?? '/', $expiresAt)], 201);
        } catch (\Throwable) { return response()->json(['ok' => false, 'error' => 'Dropbox token exchange failed.'], 502); }
    }
    public function show(Request $request, DropboxConnectionService $dropbox): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;
        return response()->json(['ok' => true, 'dropbox' => $dropbox->status($request->attributes->get('archive_user'))]);
    }
    public function connect(Request $request, DropboxConnectionService $dropbox): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;
        $data = $request->validate(['accessToken' => ['required', 'string', 'max:4096'], 'refreshToken' => ['nullable', 'string', 'max:4096'], 'folderPath' => ['nullable', 'string', 'max:1024'], 'expiresAt' => ['nullable', 'date']]);
        try {
            return response()->json(['ok' => true, 'dropbox' => $dropbox->connect($request->attributes->get('archive_user'), $data['accessToken'], $data['refreshToken'] ?? null, $data['folderPath'] ?? '/', $data['expiresAt'] ?? null)], 201);
        } catch (\LogicException $e) { return response()->json(['ok' => false, 'error' => $e->getMessage()], 409); }
    }
    public function disconnect(Request $request, DropboxConnectionService $dropbox): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;
        return response()->json(['ok' => true, 'dropbox' => $dropbox->disconnect($request->attributes->get('archive_user'))]);
    }

    public function sync(Request $request, DropboxSyncService $sync): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) return $denied;
        try { return response()->json(['ok' => true, 'sync' => $sync->import($request->attributes->get('archive_user'))]); }
        catch (\LogicException $e) { return response()->json(['ok' => false, 'error' => $e->getMessage()], 409); }
        catch (\Throwable) { return response()->json(['ok' => false, 'error' => 'Dropbox sync failed.'], 502); }
    }
}
