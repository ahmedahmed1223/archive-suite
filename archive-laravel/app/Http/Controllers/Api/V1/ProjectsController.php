<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

// V1-861: lightweight grouping of records under a project/production, without
// moving them out of their existing type or folder.
class ProjectsController extends Controller
{
    public function index(): JsonResponse
    {
        $projects = DB::table('projects')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (stdClass $project): array => $this->formatProject($project))
            ->values();

        return response()->json(['ok' => true, 'projects' => $projects]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:200'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ]);

        $id = (string) Str::uuid();
        $now = now();
        DB::table('projects')->insert([
            'id' => $id,
            'name' => $validated['name'],
            'notes' => $validated['notes'] ?? null,
            'sort_order' => $validated['sortOrder'] ?? 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $project = DB::table('projects')->where('id', $id)->first();

        return response()->json(['ok' => true, 'project' => $this->formatProject($project)], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $deleted = DB::table('projects')->where('id', $id)->delete();

        if ($deleted < 1) {
            return response()->json(['ok' => false, 'error' => 'Project not found.', 'code' => 'not_found'], 404);
        }

        DB::table('project_records')->where('project_id', $id)->delete();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'min:1', 'max:200'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'sortOrder' => ['sometimes', 'integer', 'min:0'],
        ]);
        if ($validated === []) return response()->json(['ok' => false, 'error' => 'No project fields supplied.', 'code' => 'validation_error'], 422);

        $changes = [];
        if (array_key_exists('name', $validated)) $changes['name'] = $validated['name'];
        if (array_key_exists('notes', $validated)) $changes['notes'] = $validated['notes'];
        if (array_key_exists('sortOrder', $validated)) $changes['sort_order'] = $validated['sortOrder'];
        $changes['updated_at'] = now();
        if (DB::table('projects')->where('id', $id)->update($changes) < 1) return response()->json(['ok' => false, 'error' => 'Project not found.', 'code' => 'not_found'], 404);

        return response()->json(['ok' => true, 'project' => $this->formatProject(DB::table('projects')->where('id', $id)->first())]);
    }

    public function records(string $id): JsonResponse
    {
        if (! DB::table('projects')->where('id', $id)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Project not found.', 'code' => 'not_found'], 404);
        }

        $recordIds = DB::table('project_records')
            ->where('project_id', $id)
            ->orderBy('position')
            ->orderBy('linked_at')
            ->get(['record_id', 'position'])
            ->map(fn (stdClass $link): array => ['recordId' => $link->record_id, 'position' => (int) $link->position])
            ->values();

        return response()->json(['ok' => true, 'recordIds' => $recordIds->pluck('recordId')->values(), 'records' => $recordIds]);
    }

    public function link(string $id, string $recordId): JsonResponse
    {
        if (! DB::table('projects')->where('id', $id)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Project not found.', 'code' => 'not_found'], 404);
        }

        DB::table('project_records')->updateOrInsert(
            ['project_id' => $id, 'record_id' => $recordId],
            ['linked_at' => now(), 'position' => (int) DB::table('project_records')->where('project_id', $id)->max('position') + 1]
        );

        return response()->json(['ok' => true]);
    }

    public function unlink(string $id, string $recordId): JsonResponse
    {
        DB::table('project_records')->where('project_id', $id)->where('record_id', $recordId)->delete();

        return response()->json(['ok' => true]);
    }

    public function reorder(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate(['recordIds' => ['required', 'array'], 'recordIds.*' => ['required', 'string', 'max:255', 'distinct']]);
        $existing = DB::table('project_records')->where('project_id', $id)->pluck('record_id')->sort()->values()->all();
        $requested = collect($validated['recordIds'])->sort()->values()->all();
        if ($existing === [] && ! DB::table('projects')->where('id', $id)->exists()) return response()->json(['ok' => false, 'error' => 'Project not found.', 'code' => 'not_found'], 404);
        if ($existing !== $requested) return response()->json(['ok' => false, 'error' => 'recordIds must contain every linked record exactly once.', 'code' => 'record_order_mismatch'], 422);
        foreach ($validated['recordIds'] as $position => $recordId) DB::table('project_records')->where('project_id', $id)->where('record_id', $recordId)->update(['position' => $position]);

        return $this->records($id);
    }

    public function recordProjects(string $recordId): JsonResponse
    {
        $projects = DB::table('projects')
            ->join('project_records', 'projects.id', '=', 'project_records.project_id')
            ->where('project_records.record_id', $recordId)
            ->select('projects.*')
            ->orderBy('projects.name')
            ->get()
            ->map(fn (stdClass $project): array => $this->formatProject($project))
            ->values();

        return response()->json(['ok' => true, 'projects' => $projects]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatProject(stdClass $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'notes' => $project->notes,
            'sortOrder' => (int) $project->sort_order,
            'createdAt' => $project->created_at,
            'updatedAt' => $project->updated_at,
        ];
    }
}
