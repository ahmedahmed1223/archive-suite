<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

// V1-827/V1-874: internal per-type templates with department ownership.
// Applying a template to a draft is still a pure client-side preview; saved
// records retain their applied values when this template later changes.
class MetadataTemplatesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $typeId = $request->string('typeId')->trim()->toString();
        $departmentId = $request->string('departmentId')->trim()->toString();
        $includeDisabled = $request->boolean('includeDisabled');
        if ($includeDisabled && ($denied = $this->requireEditor($request))) {
            return $denied;
        }

        $templates = DB::table('metadata_templates')
            ->when($typeId !== '', fn ($query) => $query->where('type_id', $typeId))
            ->when($departmentId !== '', fn ($query) => $query->where('department_id', $departmentId))
            ->when(! $includeDisabled, fn ($query) => $query->where('enabled', true))
            ->when(! $includeDisabled, fn ($query) => $query->whereNotNull('published_version'))
            ->orderBy('name')
            ->get()
            ->filter(fn (stdClass $template): bool => $includeDisabled || $this->canUse($template, $request))
            ->map(fn (stdClass $template): array => $includeDisabled ? $this->formatTemplate($template) : $this->formatPublishedTemplate($template))
            ->values();

        return response()->json(['ok' => true, 'templates' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $rules = $this->rules(requireName: true);
        $rules['departmentId'] = ['required', 'string', 'max:100'];
        $validated = $request->validate($rules);
        $id = (string) Str::uuid();
        $now = now();
        $actorId = (string) $request->attributes->get('archive_user')?->getKey();
        DB::transaction(function () use ($validated, $id, $now, $actorId): void {
            DB::table('metadata_templates')->insert([
                'id' => $id,
                'type_id' => $validated['typeId'] ?? null,
                'department_id' => $validated['departmentId'] ?? null,
                'name' => $validated['name'],
                'fields' => json_encode($validated['fields'] ?? new stdClass, JSON_THROW_ON_ERROR),
                'tags' => json_encode($validated['tags'] ?? [], JSON_THROW_ON_ERROR),
                'enabled' => $validated['enabled'] ?? true,
                'usage_roles' => json_encode($validated['usageRoles'] ?? [], JSON_THROW_ON_ERROR),
                'current_version' => 1,
                'created_by_id' => $actorId ?: null,
                'updated_by_id' => $actorId ?: null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $this->writeVersion(DB::table('metadata_templates')->where('id', $id)->first(), $actorId ?: null);
        });

        $template = DB::table('metadata_templates')->where('id', $id)->first();

        return response()->json(['ok' => true, 'template' => $this->formatTemplate($template)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $template = DB::table('metadata_templates')->where('id', $id)->first();
        if (! $template instanceof stdClass) {
            return $this->notFound();
        }

        $validated = $request->validate($this->rules(requireName: false));
        if ($validated === []) {
            return response()->json(['ok' => true, 'template' => $this->formatTemplate($template)]);
        }

        $actorId = (string) $request->attributes->get('archive_user')?->getKey();
        $updates = ['updated_at' => now(), 'updated_by_id' => $actorId ?: null, 'current_version' => $template->current_version + 1];

        if (array_key_exists('name', $validated)) {
            $updates['name'] = $validated['name'];
        }
        if (array_key_exists('typeId', $validated)) {
            $updates['type_id'] = $validated['typeId'];
        }
        if (array_key_exists('departmentId', $validated)) {
            $updates['department_id'] = $validated['departmentId'];
        }
        if (array_key_exists('fields', $validated)) {
            $updates['fields'] = json_encode($validated['fields'], JSON_THROW_ON_ERROR);
        }
        if (array_key_exists('tags', $validated)) {
            $updates['tags'] = json_encode($validated['tags'], JSON_THROW_ON_ERROR);
        }
        if (array_key_exists('enabled', $validated)) {
            $updates['enabled'] = $validated['enabled'];
        }
        if (array_key_exists('usageRoles', $validated)) {
            $updates['usage_roles'] = json_encode($validated['usageRoles'], JSON_THROW_ON_ERROR);
        }

        DB::transaction(function () use ($id, $updates, $actorId): void {
            DB::table('metadata_templates')->where('id', $id)->update($updates);
            $this->writeVersion(DB::table('metadata_templates')->where('id', $id)->first(), $actorId ?: null);
        });
        $updated = DB::table('metadata_templates')->where('id', $id)->first();

        return response()->json(['ok' => true, 'template' => $this->formatTemplate($updated)]);
    }

    public function versions(Request $request, string $id): JsonResponse
    {
        $template = DB::table('metadata_templates')->where('id', $id)->first();
        if (! $template instanceof stdClass || (! $template->enabled && $this->requireEditor($request)) || ($template->enabled && ! $this->canUse($template, $request))) {
            return $this->notFound();
        }

        $versions = DB::table('metadata_template_versions')->where('template_id', $id)->orderByDesc('version')->get()
            ->map(fn (stdClass $version): array => [
                'id' => $version->id,
                'version' => $version->version,
                'snapshot' => json_decode((string) $version->snapshot, true),
                'createdById' => $version->created_by_id,
                'createdAt' => $version->created_at,
            ])->values();

        return response()->json(['ok' => true, 'versions' => $versions]);
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $template = DB::table('metadata_templates')->where('id', $id)->first();
        if (! $template instanceof stdClass) {
            return $this->notFound();
        }

        DB::table('metadata_templates')->where('id', $id)->update([
            'published_version' => $template->current_version,
            'published_by_id' => $request->attributes->get('archive_user')?->getKey(),
            'published_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true, 'template' => $this->formatTemplate(DB::table('metadata_templates')->where('id', $id)->first())]);
    }

    public function restorePublished(Request $request, string $id, int $version): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $template = DB::table('metadata_templates')->where('id', $id)->first();
        $snapshot = DB::table('metadata_template_versions')->where('template_id', $id)->where('version', $version)->exists();
        if (! $template instanceof stdClass || ! $snapshot) {
            return $this->notFound();
        }

        DB::table('metadata_templates')->where('id', $id)->update([
            'published_version' => $version,
            'published_by_id' => $request->attributes->get('archive_user')?->getKey(),
            'published_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true, 'template' => $this->formatTemplate(DB::table('metadata_templates')->where('id', $id)->first())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $deleted = DB::table('metadata_templates')->where('id', $id)->delete();

        if ($deleted < 1) {
            return $this->notFound();
        }

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['ok' => false, 'error' => 'Template not found.', 'code' => 'not_found'], 404);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $requireName): array
    {
        return [
            'name' => [$requireName ? 'required' : 'sometimes', 'string', 'min:1', 'max:200'],
            'typeId' => ['sometimes', 'nullable', 'string', 'max:100'],
            'departmentId' => ['sometimes', 'nullable', 'string', 'max:100'],
            'fields' => ['sometimes', 'array'],
            'tags' => ['sometimes', 'array'],
            'tags.*' => ['string'],
            'enabled' => ['sometimes', 'boolean'],
            'usageRoles' => ['sometimes', 'array'],
            'usageRoles.*' => ['string', 'in:viewer,editor,admin'],
        ];
    }

    private function canUse(stdClass $template, Request $request): bool
    {
        $roles = json_decode((string) ($template->usage_roles ?? '[]'), true);
        if (! is_array($roles) || $roles === []) {
            return true;
        }

        return in_array($request->attributes->get('archive_user')?->role, $roles, true);
    }

    private function writeVersion(?stdClass $template, ?string $actorId): void
    {
        if (! $template instanceof stdClass) {
            return;
        }

        DB::table('metadata_template_versions')->insert([
            'id' => (string) Str::uuid(),
            'template_id' => $template->id,
            'version' => $template->current_version,
            'snapshot' => json_encode($this->formatTemplate($template), JSON_THROW_ON_ERROR),
            'created_by_id' => $actorId,
            'created_at' => now(),
        ]);
    }

    /** Return the last approved snapshot rather than a newer private draft. */
    private function formatPublishedTemplate(stdClass $template): array
    {
        $version = DB::table('metadata_template_versions')->where('template_id', $template->id)->where('version', $template->published_version)->first();
        $snapshot = $version?->snapshot ? json_decode((string) $version->snapshot, true) : null;

        return is_array($snapshot) ? [...$this->formatTemplate($template), ...$snapshot, 'publishedVersion' => (int) $template->published_version, 'publishedById' => $template->published_by_id, 'publishedAt' => $template->published_at] : $this->formatTemplate($template);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatTemplate(stdClass $template): array
    {
        return [
            'id' => $template->id,
            'typeId' => $template->type_id,
            'departmentId' => $template->department_id,
            'name' => $template->name,
            'fields' => $template->fields ? json_decode((string) $template->fields, true) : [],
            'tags' => $template->tags ? json_decode((string) $template->tags, true) : [],
            'enabled' => (bool) $template->enabled,
            'usageRoles' => $template->usage_roles ? json_decode((string) $template->usage_roles, true) : [],
            'currentVersion' => (int) $template->current_version,
            'createdById' => $template->created_by_id,
            'updatedById' => $template->updated_by_id,
            'publishedVersion' => $template->published_version === null ? null : (int) $template->published_version,
            'publishedById' => $template->published_by_id,
            'publishedAt' => $template->published_at,
            'createdAt' => $template->created_at,
            'updatedAt' => $template->updated_at,
        ];
    }
}
