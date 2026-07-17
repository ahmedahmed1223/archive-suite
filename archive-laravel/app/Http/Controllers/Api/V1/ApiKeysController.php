<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;

/**
 * V1-759: admin-managed API keys for external automation. The raw token is
 * generated here and returned exactly once in the store() response; only
 * ApiToken::hash($token) is ever persisted (see AuthenticateArchiveApiRequest
 * for the verification side).
 */
class ApiKeysController extends Controller
{
    /** Keys can never be issued at admin level — capped at editor. */
    private const ROLES = ['editor', 'viewer'];

    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $keys = DB::table('api_keys')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatKey($row))
            ->values();

        return response()->json(['ok' => true, 'apiKeys' => $keys]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'role' => ['required', Rule::in(self::ROLES)],
        ]);

        $admin = $request->attributes->get('archive_user');
        $now = now();
        $id = (string) Str::uuid();
        $token = ApiToken::create();

        DB::table('api_keys')->insert([
            'id' => $id,
            'name' => $validated['name'],
            'role' => $validated['role'],
            'token_hash' => ApiToken::hash($token),
            'user_id' => $admin->getKey(),
            'last_used_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $row = DB::table('api_keys')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'apiKey' => $this->formatKey($row),
            'token' => $token,
        ], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $deleted = DB::table('api_keys')->where('id', $id)->delete();

        if ($deleted === 0) {
            return response()->json(['ok' => false, 'error' => 'API key not found.'], 404);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatKey(stdClass $row): array
    {
        return [
            'id' => $row->id,
            'name' => $row->name,
            'role' => $row->role,
            'lastUsedAt' => $row->last_used_at,
            'createdAt' => $row->created_at,
        ];
    }
}
