<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;

class SavedSearchesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);
        $searches = DB::table('saved_searches')
            ->leftJoin('saved_search_access as access', function ($join) use ($userId): void {
                $join->on('access.saved_search_id', '=', 'saved_searches.id')->where('access.user_id', '=', $userId);
            })
            ->where(fn ($query) => $query->where('saved_searches.user_id', $userId)->orWhereNotNull('access.id'))
            ->select('saved_searches.*', 'access.role as access_role')
            ->orderByDesc('saved_searches.created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatSearch($row, $userId))
            ->values();

        return response()->json(['ok' => true, 'searches' => $searches]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'query' => ['nullable', 'string', 'max:500'],
            'filters' => ['nullable', 'array'],
            'departmentId' => ['nullable', 'string', 'max:100'],
        ]);
        $userId = $this->userId($request);
        $now = now();
        $id = (string) Str::uuid();

        DB::table('saved_searches')->insert([
            'id' => $id,
            'user_id' => $userId,
            'name' => trim((string) $validated['name']),
            'query' => $validated['query'] ?? null,
            'filters' => isset($validated['filters']) ? json_encode($validated['filters'], JSON_THROW_ON_ERROR) : null,
            'department_id' => $validated['departmentId'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json(['ok' => true, 'search' => $this->formatSearch($this->owned($id, $userId), $userId)], 201);
    }

    public function replaceAccess(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'departmentId' => ['nullable', 'string', 'max:100'],
            'members' => ['present', 'array', 'max:100'],
            'members.*.userId' => ['required', 'string', 'max:100', 'distinct'],
            'members.*.role' => ['required', 'string', Rule::in(['editor', 'viewer'])],
        ]);
        $userId = $this->userId($request);
        $search = $this->accessible($id, $userId);
        if (! $search || ! $this->canManage($search, $userId)) return $this->notFound();

        DB::transaction(function () use ($validated, $id): void {
            DB::table('saved_search_access')->where('saved_search_id', $id)->delete();
            $now = now();
            $rows = array_map(fn (array $member): array => [
                'id' => (string) Str::uuid(),
                'saved_search_id' => $id,
                'user_id' => $member['userId'],
                'role' => $member['role'],
                'created_at' => $now,
                'updated_at' => $now,
            ], $validated['members']);
            if ($rows !== []) DB::table('saved_search_access')->insert($rows);
            DB::table('saved_searches')->where('id', $id)->update([
                'department_id' => $validated['departmentId'] ?? null,
                'shared_at' => $rows === [] ? null : $now,
                'updated_at' => $now,
            ]);
        });

        return response()->json(['ok' => true, 'search' => $this->formatSearch($this->accessible($id, $userId), $userId)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $deleted = DB::table('saved_searches')->where('id', $id)->where('user_id', $this->userId($request))->delete();
        if ($deleted < 1) return $this->notFound();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    public function copy(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $source = $this->accessible($id, $userId);
        if (! $source) return $this->notFound();

        $copyId = (string) Str::uuid();
        $now = now();
        DB::table('saved_searches')->insert([
            'id' => $copyId,
            'user_id' => $userId,
            'name' => $source->name,
            'query' => $source->query,
            'filters' => $source->filters,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json(['ok' => true, 'search' => $this->formatSearch($this->owned($copyId, $userId), $userId)], 201);
    }

    private function accessible(string $id, string $userId): ?stdClass
    {
        return DB::table('saved_searches')
            ->leftJoin('saved_search_access as access', function ($join) use ($userId): void {
                $join->on('access.saved_search_id', '=', 'saved_searches.id')->where('access.user_id', '=', $userId);
            })
            ->where('saved_searches.id', $id)
            ->where(fn ($query) => $query->where('saved_searches.user_id', $userId)->orWhereNotNull('access.id'))
            ->select('saved_searches.*', 'access.role as access_role')
            ->first();
    }

    private function owned(string $id, string $userId): ?stdClass { return DB::table('saved_searches')->where('id', $id)->where('user_id', $userId)->first(); }
    private function userId(Request $request): string { return (string) $request->attributes->get('archive_user')?->getKey(); }
    private function canManage(stdClass $search, string $userId): bool { return $search->user_id === $userId || ($search->access_role ?? null) === 'editor'; }

    /** @return array<string, mixed> */
    private function formatSearch(?stdClass $row, string $userId): array
    {
        if (! $row) return [];
        $role = $row->user_id === $userId ? 'owner' : $row->access_role;
        $canManage = in_array($role, ['owner', 'editor'], true);
        $hasMembers = DB::table('saved_search_access')->where('saved_search_id', $row->id)->exists();
        $members = $canManage ? DB::table('saved_search_access')->where('saved_search_id', $row->id)->orderBy('created_at')->get(['user_id', 'role'])->map(fn (stdClass $member): array => ['userId' => $member->user_id, 'role' => $member->role])->values()->all() : [];

        return [
            'id' => $row->id,
            'name' => $row->name,
            'query' => $row->query,
            'filters' => $row->filters ? json_decode((string) $row->filters, true) : null,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
            'ownerId' => $row->user_id,
            'departmentId' => $row->department_id,
            'accessRole' => $role,
            'members' => $members,
            'shared' => $hasMembers,
            'canManage' => $canManage,
        ];
    }

    private function notFound(): JsonResponse { return response()->json(['ok' => false, 'error' => 'Saved search not found.', 'code' => 'not_found'], 404); }
}
