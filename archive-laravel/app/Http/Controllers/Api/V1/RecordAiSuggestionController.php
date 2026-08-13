<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Ai\Agents\RecordSuggestionAgent;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Repositories\StorageRowRepository;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

/**
 * AI-803: structured suggestions with mandatory human review. store() is
 * the only place that calls the LLM; approve()/reject() never touch
 * storage_rows - applying an approved suggestion stays a manual edit
 * through the normal record form, same boundary ArchiveAssistantAgent (AI-802)
 * already holds.
 */
class RecordAiSuggestionController extends Controller
{
    public function __construct(private readonly StorageRowRepository $storageRows) {}

    public function index(Request $request, string $recordId): JsonResponse
    {
        $suggestions = DB::table('ai_record_suggestions')
            ->where('record_id', $recordId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (stdClass $row): array => $this->format($row))
            ->values();

        return response()->json(['ok' => true, 'suggestions' => $suggestions]);
    }

    public function store(Request $request, string $recordId): JsonResponse
    {
        $row = $this->storageRows->findByUidOrRecordId($recordId, $request->input('store'));
        if (! $row instanceof stdClass) {
            return response()->json(['ok' => false, 'error' => 'Record not found.', 'code' => 'not_found'], 404);
        }

        $record = StorageRowPayload::format($row);
        $text = $this->sourceText($record);
        if ($text === '') {
            return response()->json(['ok' => false, 'error' => 'No transcript or descriptive text is available to suggest from.', 'code' => 'ai_source_required'], 422);
        }

        $user = $request->attributes->get('archive_user');
        $startedAt = hrtime(true);
        $suggested = (new RecordSuggestionAgent)->prompt($text)->toArray();
        $durationMs = (int) round((hrtime(true) - $startedAt) / 1_000_000);

        $id = (string) Str::uuid();
        $now = now();
        DB::table('ai_record_suggestions')->insert([
            'id' => $id,
            'record_id' => $recordId,
            'summary' => $suggested['summary'] ?? null,
            'tags' => json_encode($suggested['tags'] ?? [], JSON_THROW_ON_ERROR),
            'type' => $suggested['type'] ?? null,
            'subtype' => $suggested['subtype'] ?? null,
            'status' => 'pending',
            'created_by' => $user?->getKey(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        AuditLog::query()->create([
            'action' => 'ai.suggestion.create',
            'event' => 'ai_suggestion.create',
            'resource_type' => 'ai_record_suggestion',
            'resource_id' => $id,
            'actor_id' => $user?->getKey(),
            'outcome' => 'success',
            'status_code' => 201,
            'metadata' => ['recordId' => $recordId, 'durationMs' => $durationMs],
            'ip_address' => null,
            'user_agent' => null,
        ]);

        $created = DB::table('ai_record_suggestions')->where('id', $id)->first();

        return response()->json(['ok' => true, 'suggestion' => $this->format($created)], 201);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        return $this->review($request, $id, 'approved');
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        return $this->review($request, $id, 'rejected');
    }

    private function review(Request $request, string $id, string $status): JsonResponse
    {
        $existing = DB::table('ai_record_suggestions')->where('id', $id)->first();
        if (! $existing instanceof stdClass) {
            return response()->json(['ok' => false, 'error' => 'Suggestion not found.', 'code' => 'not_found'], 404);
        }

        $user = $request->attributes->get('archive_user');
        $now = now();
        DB::table('ai_record_suggestions')->where('id', $id)->update([
            'status' => $status,
            'reviewed_by' => $user?->getKey(),
            'reviewed_at' => $now,
            'updated_at' => $now,
        ]);

        AuditLog::query()->create([
            'action' => 'ai.suggestion.'.$status,
            'event' => 'ai_suggestion.'.$status,
            'resource_type' => 'ai_record_suggestion',
            'resource_id' => $id,
            'actor_id' => $user?->getKey(),
            'outcome' => 'success',
            'status_code' => 200,
            'metadata' => ['recordId' => $existing->record_id],
            'ip_address' => null,
            'user_agent' => null,
        ]);

        $updated = DB::table('ai_record_suggestions')->where('id', $id)->first();

        return response()->json(['ok' => true, 'suggestion' => $this->format($updated)]);
    }

    /** @param array<string, mixed> $record */
    private function sourceText(array $record): string
    {
        foreach (['transcript', 'description', 'title'] as $key) {
            $value = trim((string) ($record[$key] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    /** @return array<string, mixed> */
    private function format(stdClass $row): array
    {
        return [
            'id' => $row->id,
            'recordId' => $row->record_id,
            'summary' => $row->summary,
            'tags' => json_decode((string) $row->tags, true) ?? [],
            'type' => $row->type,
            'subtype' => $row->subtype,
            'status' => $row->status,
            'createdBy' => $row->created_by,
            'reviewedBy' => $row->reviewed_by,
            'reviewedAt' => $row->reviewed_at,
            'createdAt' => $row->created_at,
        ];
    }
}
