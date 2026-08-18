<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use JsonException;
use stdClass;

/**
 * V3-WORK-002: CRUD for archive/review/production automation-rule presets.
 * A template's fields mirror CreateAutomationRuleRequest exactly (see
 * AutomationRulesController) so the frontend can copy a template straight
 * into the create-rule form; applying one still goes through the normal
 * POST /automation/rules endpoint - this controller never runs a rule or
 * touches storage_rows itself.
 *
 * Read is open to any authenticated user (picking a template to apply is
 * part of the normal create-rule flow, same as AutomationRulesController's
 * own index()); managing the template catalog itself is an admin action,
 * same boundary as CapabilitiesController::update().
 */
class AutomationRuleTemplatesController extends Controller
{
    private const CATEGORIES = ['archive', 'review', 'production'];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['nullable', 'string', Rule::in(self::CATEGORIES)],
        ]);

        $query = DB::table('automation_rule_templates')->orderBy('category')->orderBy('name');
        if (! empty($validated['category'])) {
            $query->where('category', $validated['category']);
        }

        return response()->json([
            'ok' => true,
            'templates' => $query->get()->map(fn (stdClass $row): array => $this->format($row))->values(),
        ]);
    }

    /**
     * @throws JsonException
     */
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate($this->rules(requireAll: true));
        $id = (string) Str::uuid();
        $now = now();

        DB::table('automation_rule_templates')->insert([
            'id' => $id,
            'category' => $validated['category'],
            'name' => trim((string) $validated['name']),
            'description' => $this->trimmedOrNull($validated['description'] ?? null),
            'trigger' => $validated['trigger'],
            'conditions' => json_encode($this->conditions($validated), JSON_THROW_ON_ERROR),
            'action' => $validated['action'],
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json([
            'ok' => true,
            'template' => $this->format(DB::table('automation_rule_templates')->where('id', $id)->first()),
        ], 201);
    }

    /**
     * @throws JsonException
     */
    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $template = DB::table('automation_rule_templates')->where('id', $id)->first();
        if (! $template instanceof stdClass) {
            return $this->notFound();
        }

        $validated = $request->validate($this->rules(requireAll: false));
        if ($validated === []) {
            return response()->json(['ok' => false, 'error' => 'No template fields supplied.', 'code' => 'validation_error'], 422);
        }

        $updates = ['updated_at' => now()];
        foreach (['category', 'name', 'trigger', 'action'] as $field) {
            if (array_key_exists($field, $validated)) {
                $updates[$field] = $field === 'name' ? trim((string) $validated[$field]) : $validated[$field];
            }
        }
        if (array_key_exists('description', $validated)) {
            $updates['description'] = $this->trimmedOrNull($validated['description']);
        }

        $conditionFields = ['query', 'type', 'tag', 'status', 'fileExtension', 'departmentId'];
        if (array_intersect(array_keys($validated), $conditionFields) !== []) {
            $current = $this->decodeJsonObject($template->conditions);
            $updates['conditions'] = json_encode(array_replace($current, $this->conditions($validated, includeMissing: false)), JSON_THROW_ON_ERROR);
        }

        DB::table('automation_rule_templates')->where('id', $id)->update($updates);

        return response()->json([
            'ok' => true,
            'template' => $this->format(DB::table('automation_rule_templates')->where('id', $id)->first()),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        if (DB::table('automation_rule_templates')->where('id', $id)->delete() < 1) {
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
            'name' => [$requireAll ? 'required' : 'sometimes', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:1000'],
            'trigger' => [$requireAll ? 'required' : 'sometimes', 'string', Rule::in(AutomationRulesController::TRIGGERS)],
            'query' => ['nullable', 'string', 'max:500'],
            'type' => ['nullable', 'string', 'max:100'],
            'tag' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:100'],
            'fileExtension' => ['nullable', 'string', 'max:200'],
            'departmentId' => ['nullable', 'string', 'max:100'],
            'action' => [$requireAll ? 'required' : 'sometimes', 'string', Rule::in(AutomationRulesController::ACTIONS)],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, string>
     */
    private function conditions(array $validated, bool $includeMissing = true): array
    {
        $conditions = [];
        foreach (['query', 'type', 'tag', 'status', 'fileExtension', 'departmentId'] as $field) {
            if (array_key_exists($field, $validated)) {
                $conditions[$field] = trim((string) ($validated[$field] ?? ''));
            } elseif ($includeMissing) {
                $conditions[$field] = '';
            }
        }

        return $conditions;
    }

    /**
     * @return array<string, mixed>
     */
    private function format(?stdClass $row): array
    {
        if (! $row) {
            return [];
        }

        $conditions = $this->decodeJsonObject($row->conditions);

        return [
            'id' => $row->id,
            'category' => $row->category,
            'name' => $row->name,
            'description' => $row->description,
            'trigger' => $row->trigger,
            'query' => $conditions['query'] ?? '',
            'type' => $conditions['type'] ?? '',
            'tag' => $conditions['tag'] ?? '',
            'status' => $conditions['status'] ?? '',
            'fileExtension' => $conditions['fileExtension'] ?? '',
            'departmentId' => $conditions['departmentId'] ?? '',
            'action' => $row->action,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonObject(mixed $value): array
    {
        $decoded = is_string($value) ? json_decode($value, true) : $value;

        return is_array($decoded) ? $decoded : [];
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
            'error' => 'Automation rule template not found.',
            'code' => 'not_found',
        ], 404);
    }
}
