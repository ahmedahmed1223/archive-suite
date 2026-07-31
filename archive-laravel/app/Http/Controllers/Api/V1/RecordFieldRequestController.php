<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

// V1-872: a small, field-scoped follow-up request — assignee + due date +
// resolution — surfaced in work lists. No new task platform, no external
// messaging: this is the whole feature.
class RecordFieldRequestController extends Controller
{
    public function index(Request $request, string $recordId): JsonResponse
    {
        $requests = DB::table('record_field_requests')
            ->where('record_id', $recordId)
            ->orderByRaw('resolved_at is not null')
            ->orderBy('due_date')
            ->orderBy('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->format($row))
            ->values();

        return response()->json(['ok' => true, 'requests' => $requests]);
    }

    /** Cross-record open requests, for work-list surfaces — optionally scoped to an assignee. */
    public function open(Request $request): JsonResponse
    {
        $assignee = $request->string('assignee')->trim()->toString();

        $requests = DB::table('record_field_requests')
            ->whereNull('resolved_at')
            ->when($assignee !== '', fn ($query) => $query->where('assignee', $assignee))
            ->orderBy('due_date')
            ->orderBy('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->format($row))
            ->values();

        return response()->json(['ok' => true, 'requests' => $requests]);
    }

    public function store(Request $request, string $recordId): JsonResponse
    {
        $validated = $request->validate([
            'field' => ['required', 'string', 'max:100'],
            'message' => ['required', 'string', 'min:1', 'max:2000'],
            'assignee' => ['nullable', 'string', 'max:200'],
            'dueDate' => ['nullable', 'date'],
            'departmentId' => ['nullable', 'string', 'max:100'],
        ]);

        $user = $request->attributes->get('archive_user');
        $id = (string) Str::uuid();
        $now = now();
        $departmentId = $validated['departmentId'] ?? null;
        $fieldOwner = $departmentId ? DB::table('department_field_owners')->where('department_id', $departmentId)->whereIn('field', [$validated['field'], '*'])->orderByRaw("case when field = ? then 0 else 1 end", [$validated['field']])->value('owner') : null;

        DB::table('record_field_requests')->insert([
            'id' => $id,
            'record_id' => $recordId,
            'field' => $validated['field'],
            'message' => $validated['message'],
            'assignee' => $validated['assignee'] ?? $fieldOwner,
            'due_date' => $validated['dueDate'] ?? null,
            'department_id' => $departmentId,
            'field_owner' => $fieldOwner,
            'created_by' => $user?->getKey(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $created = DB::table('record_field_requests')->where('id', $id)->first();

        return response()->json(['ok' => true, 'request' => $this->format($created)], 201);
    }

    public function resolve(Request $request, string $id): JsonResponse
    {
        $existing = DB::table('record_field_requests')->where('id', $id)->first();
        if (! $existing) return $this->notFound();

        $user = $request->attributes->get('archive_user');
        DB::table('record_field_requests')->where('id', $id)->update([
            'resolved_at' => now(),
            'resolved_by' => $user?->getKey(),
            'updated_at' => now(),
        ]);

        $updated = DB::table('record_field_requests')->where('id', $id)->first();

        return response()->json(['ok' => true, 'request' => $this->format($updated)]);
    }

    public function destroy(string $id): JsonResponse
    {
        $deleted = DB::table('record_field_requests')->where('id', $id)->delete();

        if ($deleted < 1) return $this->notFound();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function format(stdClass $row): array
    {
        return [
            'id' => $row->id,
            'recordId' => $row->record_id,
            'field' => $row->field,
            'message' => $row->message,
            'assignee' => $row->assignee,
            'departmentId' => $row->department_id,
            'fieldOwner' => $row->field_owner,
            'dueDate' => $row->due_date,
            'resolvedAt' => $row->resolved_at,
            'resolvedBy' => $row->resolved_by,
            'createdAt' => $row->created_at,
        ];
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Field request not found.', 'code' => 'not_found'], 404);
    }
}
