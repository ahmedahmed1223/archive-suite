<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BulkMacro;
use App\Models\BulkMacroRun;
use App\Models\User;
use App\Services\BulkMacros\BulkMacroService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class BulkMacrosController extends Controller
{
    public function __construct(private readonly BulkMacroService $service)
    {
    }

    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        return response()->json(['ok' => true, 'macros' => BulkMacro::query()->where('user_id', $this->user($request)->id)->latest()->get()->map(fn (BulkMacro $macro) => $this->macro($macro))->values()]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $macro = $this->owned($request, $id);
        return $macro ? response()->json(['ok' => true, 'macro' => $this->macro($macro)]) : $this->notFound();
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $data = $this->validateMacro($request, true);
        $macro = BulkMacro::query()->create(['user_id' => $this->user($request)->id, 'name' => trim($data['name']), 'steps' => $data['steps'], 'version' => 1]);
        return response()->json(['ok' => true, 'macro' => $this->macro($macro)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $macro = $this->owned($request, $id);
        if (! $macro) return $this->notFound();
        $data = $this->validateMacro($request, false);
        if (array_key_exists('name', $data)) $macro->name = trim($data['name']);
        if (array_key_exists('steps', $data)) $macro->steps = $data['steps'];
        $macro->version++;
        $macro->save();
        return response()->json(['ok' => true, 'macro' => $this->macro($macro)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $macro = $this->owned($request, $id);
        if (! $macro) return $this->notFound();
        $macro->delete();
        return response()->json(['ok' => true, 'deleted' => true]);
    }

    public function preview(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $macro = $this->owned($request, $id);
        if (! $macro) return $this->notFound();
        $targets = $this->targets($request);
        return response()->json(['ok' => true, ...$this->service->preview($macro, $this->user($request), $targets)]);
    }

    public function run(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $macro = $this->owned($request, $id);
        if (! $macro) return $this->notFound();
        $targets = $this->targets($request);
        $token = $request->validate(['previewToken' => ['required', 'string']])['previewToken'];
        if ($code = $this->service->validateConfirmation($token, $macro, $this->user($request), $targets)) {
            return response()->json(['ok' => false, 'error' => 'Preview confirmation is invalid.', 'code' => $code], 422);
        }
        $run = $this->service->execute($macro, $this->user($request), $targets);
        return response()->json(['ok' => true, 'run' => $this->runResource($run)], 201);
    }

    public function runs(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $macro = $this->owned($request, $id);
        if (! $macro) return $this->notFound();
        return response()->json(['ok' => true, 'runs' => $macro->runs()->latest()->get()->map(fn (BulkMacroRun $run) => $this->runResource($run))->values()]);
    }

    /** @return array<string, mixed> */
    private function validateMacro(Request $request, bool $creating): array
    {
        $validator = Validator::make($request->all(), [
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:200'],
            'steps' => [$creating ? 'required' : 'sometimes', 'array', 'min:1', 'max:10'],
            'steps.*' => ['required', 'array'],
            'steps.*.type' => ['required', 'string', Rule::in(['add-tag', 'set-workflow-status', 'delete'])],
            'steps.*.tag' => ['nullable', 'string', 'max:100'],
            'steps.*.status' => ['nullable', 'string', Rule::in(BulkMacroService::STATUSES)],
        ]);
        $validator->after(function ($validator) use ($request): void {
            if (! $request->exists('name') && ! $request->exists('steps')) {
                $validator->errors()->add('macro', 'At least one macro field is required.');
            }
            foreach ((array) $request->input('steps', []) as $index => $step) {
                if (! is_array($step)) continue;
                if (($step['type'] ?? null) === 'add-tag' && trim((string) ($step['tag'] ?? '')) === '') $validator->errors()->add("steps.$index.tag", 'A tag is required.');
                if (($step['type'] ?? null) === 'set-workflow-status' && ! in_array($step['status'] ?? null, BulkMacroService::STATUSES, true)) $validator->errors()->add("steps.$index.status", 'A valid workflow status is required.');
            }
        });
        return $validator->validate();
    }

    /** @return array<int, array{store: string, id: string}> */
    private function targets(Request $request): array
    {
        $validated = $request->validate(['targets' => ['required', 'array', 'min:1', 'max:1000'], 'targets.*' => ['required', 'array'], 'targets.*.store' => ['required', 'string', 'max:100'], 'targets.*.id' => ['required', 'string', 'max:255']]);
        return $this->service->normalizeTargets($validated['targets']);
    }

    private function owned(Request $request, string $id): ?BulkMacro
    {
        return BulkMacro::query()->where('id', $id)->where('user_id', $this->user($request)->id)->first();
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->attributes->get('archive_user');
        return $user;
    }

    /** @return array<string, mixed> */
    private function macro(BulkMacro $macro): array
    {
        return ['id' => $macro->id, 'name' => $macro->name, 'version' => $macro->version, 'steps' => $macro->steps, 'createdAt' => $macro->created_at?->toIso8601String(), 'updatedAt' => $macro->updated_at?->toIso8601String()];
    }

    /** @return array<string, mixed> */
    private function runResource(BulkMacroRun $run): array
    {
        return ['id' => $run->id, 'macroId' => $run->macro_id, 'macroVersion' => $run->macro_version, 'targets' => $run->targets, 'results' => $run->results, 'targetCount' => $run->target_count, 'completedCount' => $run->completed_count, 'failedCount' => $run->failed_count, 'createdAt' => $run->created_at?->toIso8601String()];
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Bulk macro not found.', 'code' => 'not_found'], 404);
    }
}
