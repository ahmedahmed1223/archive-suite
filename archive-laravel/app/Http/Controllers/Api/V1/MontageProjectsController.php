<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MontageProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MontageProjectsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status', 'draft');
        $limit = (int) ($request->query('limit', 50));
        $limit = min(max($limit, 1), 100);

        $projects = MontageProject::query()
            ->where('status', $status)
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'ok' => true,
            'projects' => $projects->map(fn (MontageProject $p) => $this->payload($p))->values()->toArray(),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $project = MontageProject::query()->find($id);

        if (! $project) {
            return response()->json(['ok' => false, 'error' => 'Montage project not found.'], 404);
        }

        return response()->json([
            'ok' => true,
            'project' => $this->payload($project),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'fps' => ['nullable', 'integer', 'min:1', 'max:120'],
            'tracks' => ['nullable', 'array'],
            'clips' => ['nullable', 'array'],
            'markers' => ['nullable', 'array'],
            'comments' => ['nullable', 'array'],
            'transitions' => ['nullable', 'array'],
        ]);

        $project = MontageProject::query()->create([
            'id' => (string) Str::uuid(),
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'fps' => $validated['fps'] ?? 25,
            'tracks' => $validated['tracks'] ?? [],
            'clips' => $validated['clips'] ?? [],
            'markers' => $validated['markers'] ?? [],
            'comments' => $validated['comments'] ?? [],
            'transitions' => $validated['transitions'] ?? [],
            'status' => 'draft',
        ]);

        return response()->json([
            'ok' => true,
            'project' => $this->payload($project),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $project = MontageProject::query()->find($id);

        if (! $project) {
            return response()->json(['ok' => false, 'error' => 'Montage project not found.'], 404);
        }

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'fps' => ['nullable', 'integer', 'min:1', 'max:120'],
            'tracks' => ['nullable', 'array'],
            'clips' => ['nullable', 'array'],
            'markers' => ['nullable', 'array'],
            'comments' => ['nullable', 'array'],
            'transitions' => ['nullable', 'array'],
            'status' => ['nullable', 'string', 'in:draft,finalized,archived'],
        ]);

        $project->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json([
            'ok' => true,
            'project' => $this->payload($project),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $project = MontageProject::query()->find($id);

        if (! $project) {
            return response()->json(['ok' => false, 'error' => 'Montage project not found.'], 404);
        }

        $project->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(MontageProject $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
            'fps' => $project->fps,
            'tracks' => $project->tracks ?? [],
            'clips' => $project->clips ?? [],
            'markers' => $project->markers ?? [],
            'comments' => $project->comments ?? [],
            'transitions' => $project->transitions ?? [],
            'status' => $project->status,
            'createdAt' => $project->created_at?->toISOString(),
            'updatedAt' => $project->updated_at?->toISOString(),
        ];
    }
}
