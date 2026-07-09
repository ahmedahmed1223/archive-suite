<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use JsonException;
use stdClass;

class TypesController extends Controller
{
    /**
     * List all type definitions.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cursor' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 50);
        $cursorUid = isset($validated['cursor']) ? StorageRowPayload::decodeCursor($validated['cursor']) : null;

        $query = DB::table('storage_rows')
            ->where('store', 'types')
            ->orderBy('uid')
            ->limit($limit + 1);

        if ($cursorUid !== null) {
            $query->where('uid', '>', $cursorUid);
        }

        $rows = $query->get();
        $hasMore = $rows->count() > $limit;
        $pageRows = $rows->take($limit);
        $types = $pageRows->map(fn (stdClass $row): array => StorageRowPayload::format($row))->values();
        $lastRow = $pageRows->last();

        return response()->json([
            'ok' => true,
            'types' => $types,
            'nextCursor' => $hasMore && $lastRow instanceof stdClass ? StorageRowPayload::encodeCursor($lastRow->uid) : null,
        ]);
    }

    /**
     * Get a single type definition.
     *
     * @throws ValidationException
     * @throws JsonException
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $row = DB::table('storage_rows')
            ->where('store', 'types')
            ->where(function ($query) use ($id): void {
                $query->where('uid', $id)
                    ->orWhere('data->>\'id\'', $id);
            })
            ->first();

        if (!$row instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Type not found.',
                'code' => 'not_found',
            ], 404);
        }

        $type = StorageRowPayload::format($row);

        return response()->json([
            'ok' => true,
            'type' => $type,
        ]);
    }

    /**
     * Create or update a type definition.
     *
     * @throws ValidationException
     * @throws JsonException
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'fields' => ['required', 'array'],
            'fields.*.name' => ['required', 'string', 'max:255'],
            'fields.*.type' => ['required', 'string', 'in:text,number,date,select,multi,boolean'],
            'fields.*.fieldAcl' => ['nullable', 'array'],
            'fields.*.fieldAcl.view' => ['nullable', 'array'],
            'fields.*.fieldAcl.view.*' => ['string'],
            'fields.*.fieldAcl.edit' => ['nullable', 'array'],
            'fields.*.fieldAcl.edit.*' => ['string'],
        ]);

        $row = DB::table('storage_rows')
            ->where('store', 'types')
            ->where('uid', $validated['id'])
            ->first();

        $uid = $validated['id'];
        $data = [
            'id' => $validated['id'],
            'name' => $validated['name'],
            'fields' => $validated['fields'],
        ];

        if (!$row) {
            DB::table('storage_rows')->insert([
                'store' => 'types',
                'uid' => $uid,
                'data' => json_encode($data, JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } else {
            DB::table('storage_rows')
                ->where('store', 'types')
                ->where('uid', $uid)
                ->update([
                    'data' => json_encode($data, JSON_THROW_ON_ERROR),
                    'updated_at' => now(),
                ]);
        }

        return response()->json([
            'ok' => true,
            'type' => $data,
        ], $row ? 200 : 201);
    }

    /**
     * Delete a type definition.
     */
    public function destroy(string $id): JsonResponse
    {
        $deleted = DB::table('storage_rows')
            ->where('store', 'types')
            ->where('uid', $id)
            ->delete();

        if ($deleted === 0) {
            return response()->json([
                'ok' => false,
                'error' => 'Type not found.',
                'code' => 'not_found',
            ], 404);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Check field edit permission for the current user.
     * Returns which fields the user can view/edit based on their role.
     */
    public function checkFieldAcl(Request $request, string $typeId): JsonResponse
    {
        $request->validate([
            'fieldName' => ['required', 'string'],
        ]);

        $user = $request->user();
        $userRole = $user?->role ?? 'viewer';

        $row = DB::table('storage_rows')
            ->where('store', 'types')
            ->where('uid', $typeId)
            ->first();

        if (!$row instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Type not found.',
                'code' => 'not_found',
            ], 404);
        }

        $data = json_decode($row->data, true);
        $fieldName = $request->input('fieldName');
        $field = collect($data['fields'] ?? [])->firstWhere('name', $fieldName);

        if (!$field) {
            return response()->json([
                'ok' => false,
                'error' => 'Field not found.',
                'code' => 'not_found',
            ], 404);
        }

        $fieldAcl = $field['fieldAcl'] ?? null;
        $canView = !$fieldAcl || empty($fieldAcl['view']) || in_array($userRole, $fieldAcl['view']);
        $canEdit = !$fieldAcl || empty($fieldAcl['edit']) || in_array($userRole, $fieldAcl['edit']);

        return response()->json([
            'ok' => true,
            'fieldName' => $fieldName,
            'canView' => $canView,
            'canEdit' => $canEdit,
            'userRole' => $userRole,
        ]);
    }
}
