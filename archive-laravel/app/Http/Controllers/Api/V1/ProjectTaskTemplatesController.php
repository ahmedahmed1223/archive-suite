<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;

/**
 * V3-WORK-002: CRUD for archive/review/production project-task presets. A
 * template's fields mirror ProjectTasksController::store()'s payload
 * (title, status, targetDurationMinutes) so the frontend copies one
 * straight into the existing create-task form; this controller never
 * creates a task itself.
 *
 * Read is open to any authenticated user; managing the catalog is
 * admin-only, same boundary as AutomationRuleTemplatesController.
 */
class ProjectTaskTemplatesController extends Controller
{
    private const CATEGORIES = ['archive', 'review', 'production'];

    private const STATUSES = ['todo', 'in_progress', 'review', 'done'];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['nullable', 'string', Rule::in(self::CATEGORIES)],
        ]);

        $query = DB::table('project_task_templates')->orderBy('category')->orderBy('title');
        if (! empty($validated['category'])) {
            $query->where('category', $validated['category']);
        }

        return response()->json([
            'ok' => true,
            'templates' => $query->get()->map(fn (stdClass $row): array => $this->format($row))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate($this->rules(requireAll: true));
        $id = (string) Str::uuid();
        $now = now();

        DB::table('project_task_templates')->insert([
            'id' => $id,
            'category' => $validated['category'],
            'title' => trim((string) $validated['title']),
            'description' => $this->trimmedOrNull($validated['description'] ?? null),
            'default_status' => $validated['defaultStatus'] ?? 'todo',
            'target_duration_minutes' => $validated['targetDurationMinutes'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'ok' => true,
            'template' => $this->format(DB::table('project_task_templates')->where('id', $id)->first()),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        if (! DB::table('project_task_templates')->where('id', $id)->exists()) {
            return $this->notFound();
        }

        $validated = $request->validate($this->rules(requireAll: false));
        if ($validated === []) {
            return response()->json(['ok' => false, 'error' => 'No template fields supplied.', 'code' => 'validation_error'], 422);
        }

        $map = ['defaultStatus' => 'default_status', 'targetDurationMinutes' => 'target_duration_minutes'];
        $updates = ['updated_at' => now()];
        foreach ($validated as $field => $value) {
            $column = $map[$field] ?? $field;
            $updates[$column] = $field === 'title' ? trim((string) $value) : ($field === 'description' ? $this->trimmedOrNull($value) : $value);
        }

        DB::table('project_task_templates')->where('id', $id)->update($updates);

        return response()->json([
            'ok' => true,
            'template' => $this->format(DB::table('project_task_templates')->where('id', $id)->first()),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        if (DB::table('project_task_templates')->where('id', $id)->delete() < 1) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $requireAll): array
    {
        return [
            'category' => [$requireAll ? 'required' : 'sometimes', 'string', Rule::in(self::CATEGORIES)],
            'title' => [$requireAll ? 'required' : 'sometimes', 'string', 'max:300'],
            'description' => ['nullable', 'string', 'max:1000'],
            'defaultStatus' => ['nullable', 'string', Rule::in(self::STATUSES)],
            'targetDurationMinutes' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function format(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        return [
            'id' => $row->id,
            'category' => $row->category,
            'title' => $row->title,
            'description' => $row->description,
            'defaultStatus' => $row->default_status,
            'targetDurationMinutes' => $row->target_duration_minutes !== null ? (int) $row->target_duration_minutes : null,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    private function trimmedOrNull(mixed $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function notFound(): JsonResponse
    {
        return response()->json([
            'ok' => false,
            'error' => 'Project task template not found.',
            'code' => 'not_found',
        ], 404);
    }
}
