<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class IntakeTemplatesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $templates = DB::table('intake_templates')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->formatTemplate($row))
            ->values();

        return response()->json(['ok' => true, 'templates' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'type' => ['nullable', 'string', 'max:100'],
            'fields' => ['required', 'array', 'min:1'],
        ]);

        $user = $request->attributes->get('archive_user');
        $now = now();
        $id = (string) Str::uuid();

        DB::table('intake_templates')->insert([
            'id' => $id,
            'name' => trim((string) $validated['name']),
            'type' => $validated['type'] ?? null,
            'fields' => json_encode($validated['fields'], JSON_THROW_ON_ERROR),
            'created_by' => $user?->getKey(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $template = DB::table('intake_templates')->where('id', $id)->first();

        return response()->json([
            'ok' => true,
            'template' => $this->formatTemplate($template),
        ], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $deleted = DB::table('intake_templates')->where('id', $id)->delete();

        if ($deleted < 1) {
            return response()->json([
                'ok' => false,
                'error' => 'Template not found.',
                'code' => 'not_found',
            ], 404);
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatTemplate(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'name' => $row->name,
            'type' => $row->type,
            'fields' => json_decode((string) $row->fields, true),
            'createdBy' => $row->created_by,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }
}
