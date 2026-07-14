<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class UploadLinksController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $links = DB::table('upload_links')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatLink($row))
            ->values();

        return response()->json(['ok' => true, 'links' => $links]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:200'],
            'folder' => ['nullable', 'string', 'max:255'],
            'expiresInHours' => ['required', 'integer', 'min:1', 'max:720'],
        ]);

        $user = $request->attributes->get('archive_user');
        $now = now();
        $id = (string) Str::uuid();
        $token = Str::random(40);

        DB::table('upload_links')->insert([
            'id' => $id,
            'token' => $token,
            'label' => $validated['label'] ?? null,
            'folder' => $validated['folder'] ?? null,
            'created_by' => $user?->getKey(),
            'expires_at' => $now->clone()->addHours((int) $validated['expiresInHours']),
            'revoked_at' => null,
            'upload_count' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $link = DB::table('upload_links')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'link' => $this->formatLink($link),
        ], 201);
    }

    public function revoke(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $link = DB::table('upload_links')->where('id', $id)->first();

        if (! $link instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Upload link not found.',
                'code' => 'not_found',
            ], 404);
        }

        DB::table('upload_links')->where('id', $id)->update([
            'revoked_at' => now(),
            'updated_at' => now(),
        ]);

        $updated = DB::table('upload_links')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'link' => $this->formatLink($updated),
        ]);
    }

    /**
     * Public (unauthenticated) validation used by the external uploader to
     * confirm a token is still usable before it starts pushing files.
     */
    public function show(string $token): JsonResponse
    {
        $link = DB::table('upload_links')->where('token', $token)->first();

        if (! $link instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Upload link not found.',
                'code' => 'not_found',
            ], 404);
        }

        if ($link->revoked_at !== null) {
            return response()->json([
                'ok' => false,
                'error' => 'Upload link has been revoked.',
                'code' => 'revoked',
            ], 404);
        }

        if (now()->greaterThan($link->expires_at)) {
            return response()->json([
                'ok' => false,
                'error' => 'Upload link has expired.',
                'code' => 'expired',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'link' => $this->formatLink($link, includeToken: false),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatLink(?stdClass $link, bool $includeToken = true): array
    {
        if (! $link) {
            return [];
        }

        $data = [
            'id' => $link->id,
            'label' => $link->label,
            'folder' => $link->folder,
            'expiresAt' => $link->expires_at,
            'revoked' => $link->revoked_at !== null,
            'uploadCount' => (int) $link->upload_count,
            'createdAt' => $link->created_at,
        ];

        if ($includeToken) {
            $data['token'] = $link->token;
        }

        return $data;
    }
}
