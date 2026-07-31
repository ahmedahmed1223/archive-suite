<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class WatchedIngestRulesController extends Controller
{
    public function index(): JsonResponse { return response()->json(['ok' => true, 'rules' => DB::table('watched_ingest_rules')->orderBy('created_at')->get()->map(fn ($r) => $this->format($r))->all()]); }
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        $v = $request->validate($this->rules()); $id = (string) Str::uuid(); $now = now();
        DB::table('watched_ingest_rules')->insert(['id' => $id, 'match_type' => $v['matchType'], 'pattern' => $v['pattern'], 'metadata_template_id' => $v['metadataTemplateId'] ?? null, 'tags' => json_encode($v['tags'] ?? []), 'staging_directory' => trim($v['stagingDirectory'], '/'), 'enabled' => $v['enabled'] ?? true, 'created_at' => $now, 'updated_at' => $now]);
        return response()->json(['ok' => true, 'rule' => $this->format(DB::table('watched_ingest_rules')->where('id', $id)->first())], 201);
    }
    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        if (! DB::table('watched_ingest_rules')->where('id', $id)->exists()) return response()->json(['ok' => false, 'error' => 'Watched ingest rule not found.', 'code' => 'not_found'], 404);
        $v = $request->validate($this->rules());
        DB::table('watched_ingest_rules')->where('id', $id)->update(['match_type' => $v['matchType'], 'pattern' => $v['pattern'], 'metadata_template_id' => $v['metadataTemplateId'] ?? null, 'tags' => json_encode($v['tags'] ?? []), 'staging_directory' => trim($v['stagingDirectory'], '/'), 'enabled' => $v['enabled'] ?? true, 'updated_at' => now()]);
        return response()->json(['ok' => true, 'rule' => $this->format(DB::table('watched_ingest_rules')->where('id', $id)->first())]);
    }
    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) return $denied;
        if (DB::table('watched_ingest_rules')->where('id', $id)->delete() < 1) return response()->json(['ok' => false, 'error' => 'Watched ingest rule not found.', 'code' => 'not_found'], 404);
        return response()->json(['ok' => true, 'deleted' => true]);
    }
    private function rules(): array { return ['matchType' => ['required', 'in:path_prefix,filename_pattern'], 'pattern' => ['required', 'string', 'max:200'], 'metadataTemplateId' => ['nullable', 'string'], 'tags' => ['sometimes', 'array'], 'tags.*' => ['string'], 'stagingDirectory' => ['required', 'string', 'max:200', 'regex:/^[A-Za-z0-9_\/-]+$/'], 'enabled' => ['sometimes', 'boolean']]; }
    private function format(object $r): array { return ['id' => $r->id, 'matchType' => $r->match_type, 'pattern' => $r->pattern, 'metadataTemplateId' => $r->metadata_template_id, 'tags' => json_decode($r->tags ?: '[]', true), 'stagingDirectory' => $r->staging_directory, 'enabled' => (bool) $r->enabled]; }
}
