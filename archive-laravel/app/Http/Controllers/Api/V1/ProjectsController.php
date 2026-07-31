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
        ]);

        $id = (string) Str::uuid();
        $now = now();
        DB::table('projects')->insert([
            'id' => $id,
            'name' => $validated['name'],
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

    public function records(string $id): JsonResponse
    {
        if (! DB::table('projects')->where('id', $id)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Project not found.', 'code' => 'not_found'], 404);
        }

        $recordIds = DB::table('project_records')
            ->where('project_id', $id)
            ->orderBy('linked_at')
            ->pluck('record_id');

        return response()->json(['ok' => true, 'recordIds' => $recordIds]);
    }

    public function link(string $id, string $recordId): JsonResponse
    {
        if (! DB::table('projects')->where('id', $id)->exists()) {
            return response()->json(['ok' => false, 'error' => 'Project not found.', 'code' => 'not_found'], 404);
        }

        DB::table('project_records')->updateOrInsert(
            ['project_id' => $id, 'record_id' => $recordId],
            ['linked_at' => now()]
        );

        return response()->json(['ok' => true]);
    }

    public function unlink(string $id, string $recordId): JsonResponse
    {
        DB::table('project_records')->where('project_id', $id)->where('record_id', $recordId)->delete();

        return response()->json(['ok' => true]);
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
            'createdAt' => $project->created_at,
            'updatedAt' => $project->updated_at,
        ];
    }
}
