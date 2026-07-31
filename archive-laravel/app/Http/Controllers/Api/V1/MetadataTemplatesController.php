<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

// V1-827: internal per-type metadata templates. Applying a template to a draft
// (the "preview before create/edit") is a pure client-side concern — this
// controller only stores and serves the template definitions.
class MetadataTemplatesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $typeId = $request->string('typeId')->trim()->toString();
        $templates = DB::table('metadata_templates')
            ->when($typeId !== '', fn ($query) => $query->where('type_id', $typeId))
            ->orderBy('name')
            ->get()
            ->map(fn (stdClass $template): array => $this->formatTemplate($template))
            ->values();

        return response()->json(['ok' => true, 'templates' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules(requireName: true));

        $id = (string) Str::uuid();
        $now = now();
        DB::table('metadata_templates')->insert([
            'id' => $id,
            'type_id' => $validated['typeId'] ?? null,
            'name' => $validated['name'],
            'fields' => json_encode($validated['fields'] ?? new stdClass(), JSON_THROW_ON_ERROR),
            'tags' => json_encode($validated['tags'] ?? [], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $template = DB::table('metadata_templates')->where('id', $id)->first();

        return response()->json(['ok' => true, 'template' => $this->formatTemplate($template)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $template = DB::table('metadata_templates')->where('id', $id)->first();
        if (! $template instanceof stdClass) {
            return $this->notFound();
        }

        $validated = $request->validate($this->rules(requireName: false));
        $updates = ['updated_at' => now()];

        if (array_key_exists('name', $validated)) $updates['name'] = $validated['name'];
        if (array_key_exists('typeId', $validated)) $updates['type_id'] = $validated['typeId'];
        if (array_key_exists('fields', $validated)) $updates['fields'] = json_encode($validated['fields'], JSON_THROW_ON_ERROR);
        if (array_key_exists('tags', $validated)) $updates['tags'] = json_encode($validated['tags'], JSON_THROW_ON_ERROR);

        DB::table('metadata_templates')->where('id', $id)->update($updates);
        $updated = DB::table('metadata_templates')->where('id', $id)->first();

        return response()->json(['ok' => true, 'template' => $this->formatTemplate($updated)]);
    }

    public function destroy(string $id): JsonResponse
    {
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
            'fields' => ['sometimes', 'array'],
            'tags' => ['sometimes', 'array'],
            'tags.*' => ['string'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatTemplate(stdClass $template): array
    {
        return [
            'id' => $template->id,
            'typeId' => $template->type_id,
            'name' => $template->name,
            'fields' => $template->fields ? json_decode((string) $template->fields, true) : [],
            'tags' => $template->tags ? json_decode((string) $template->tags, true) : [],
            'createdAt' => $template->created_at,
            'updatedAt' => $template->updated_at,
        ];
    }
}
