<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;

final class ProjectTasksController extends Controller
{
    private const STATUSES = ['todo', 'in_progress', 'review', 'done'];

    public function index(Request $r): JsonResponse
    {
        $q = DB::table('project_tasks')->orderBy('updated_at', 'desc');
        if ($id = $r->query('projectId')) {
            $q->where('project_id', $id);
        }

        return response()->json(['ok' => true, 'tasks' => $q->get()->map(fn (stdClass $x) => $this->out($x))->values()]);
    }

    public function store(Request $r): JsonResponse
    {
        if ($denied = $this->requireEditor($r)) {
            return $denied;
        } $v = $r->validate(['projectId' => ['required', 'string'], 'title' => ['required', 'string', 'max:300'], 'status' => ['nullable', Rule::in(self::STATUSES)], 'assignee' => ['nullable', 'string', 'max:200'], 'recordId' => ['nullable', 'string', 'max:255'], 'dueDate' => ['nullable', 'date'], 'targetDurationMinutes' => ['nullable', 'integer', 'min:1']]);
        if (! DB::table('projects')->where('id', $v['projectId'])->exists()) {
            return response()->json(['ok' => false, 'error' => 'Project not found.', 'code' => 'not_found'], 404);
        } $id = (string) Str::uuid();
        $now = now();
        $targetDuration = $v['targetDurationMinutes'] ?? null;
        DB::table('project_tasks')->insert([
            'id' => $id, 'project_id' => $v['projectId'], 'title' => $v['title'], 'status' => $v['status'] ?? 'todo',
            'assignee' => $v['assignee'] ?? null, 'record_id' => $v['recordId'] ?? null, 'due_date' => $v['dueDate'] ?? null,
            'target_duration_minutes' => $targetDuration,
            'target_deadline_at' => $targetDuration !== null ? $now->clone()->addMinutes($targetDuration) : null,
            'created_at' => $now, 'updated_at' => $now,
        ]);

        return response()->json(['ok' => true, 'task' => $this->out(DB::table('project_tasks')->where('id', $id)->first())], 201);
    }

    public function update(Request $r, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($r)) {
            return $denied;
        } $v = $r->validate(['title' => ['sometimes', 'string', 'max:300'], 'status' => ['sometimes', Rule::in(self::STATUSES)], 'assignee' => ['sometimes', 'nullable', 'string', 'max:200'], 'recordId' => ['sometimes', 'nullable', 'string', 'max:255'], 'dueDate' => ['sometimes', 'nullable', 'date'], 'targetDurationMinutes' => ['sometimes', 'nullable', 'integer', 'min:1']]);
        if ($v === []) {
            return response()->json(['ok' => false, 'error' => 'No task fields supplied.', 'code' => 'validation_error'], 422);
        } $map = ['recordId' => 'record_id', 'dueDate' => 'due_date', 'targetDurationMinutes' => 'target_duration_minutes'];
        $u = [];
        foreach ($v as $k => $x) {
            $u[$map[$k] ?? $k] = $x;
        }$u['updated_at'] = now();
        if (array_key_exists('targetDurationMinutes', $v)) {
            // A changed (or cleared) target duration resets the SLA clock -
            // recompute the deadline from *now*, and clear the idempotency
            // markers so the escalation sweep (CheckTaskEscalationsCommand)
            // treats this as a fresh deadline rather than skipping it as
            // already-notified.
            $u['target_deadline_at'] = $v['targetDurationMinutes'] !== null ? now()->addMinutes($v['targetDurationMinutes']) : null;
            $u['due_soon_notified_at'] = null;
            $u['escalated_at'] = null;
        }
        if (DB::table('project_tasks')->where('id', $id)->update($u) < 1) {
            return response()->json(['ok' => false, 'error' => 'Task not found.', 'code' => 'not_found'], 404);
        }

        return response()->json(['ok' => true, 'task' => $this->out(DB::table('project_tasks')->where('id', $id)->first())]);
    }

    private function out(?stdClass $x): array
    {
        return [
            'id' => $x->id, 'projectId' => $x->project_id, 'title' => $x->title, 'status' => $x->status,
            'assignee' => $x->assignee, 'recordId' => $x->record_id, 'dueDate' => $x->due_date,
            'targetDurationMinutes' => $x->target_duration_minutes !== null ? (int) $x->target_duration_minutes : null,
            'targetDeadlineAt' => $x->target_deadline_at,
            'createdAt' => $x->created_at, 'updatedAt' => $x->updated_at,
        ];
    }
}
