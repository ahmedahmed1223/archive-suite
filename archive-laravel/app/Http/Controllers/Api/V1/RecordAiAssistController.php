<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

/**
 * Produces a deliberately non-mutating assistance draft.  It is an offline
 * baseline for installations without a hosted model: every output is exposed
 * as a review-required proposal and this endpoint never writes record data.
 */
final class RecordAiAssistController extends Controller
{
    public function analyze(Request $request, string $recordId): JsonResponse
    {
        $row = DB::table('storage_rows')->where('store', 'archive-items')->where('uid', $recordId)->first();
        if (! $row instanceof stdClass) {
            return response()->json(['ok' => false, 'error' => 'Archive record not found.', 'code' => 'record_not_found'], 404);
        }

        $record = StorageRowPayload::format($row);
        $text = $this->sourceText($record);
        if ($text === '') {
            return response()->json(['ok' => false, 'error' => 'No transcript or descriptive text is available for analysis.', 'code' => 'ai_source_required'], 422);
        }

        $terms = DB::table('vocabulary_terms')
            ->where('user_id', $this->userId($request))
            ->orderBy('term')
            ->get(['term', 'kind', 'aliases'])
            ->map(fn (stdClass $term): array => ['term' => (string) $term->term, 'kind' => (string) $term->kind, 'aliases' => (string) ($term->aliases ?? '')])
            ->all();
        $entities = $this->entities($text, $terms);

        return response()->json([
            'ok' => true,
            'recordId' => $recordId,
            'reviewRequired' => true,
            'provider' => 'local-assist',
            'summary' => $this->summary($text),
            'suggestedTags' => array_values(array_unique([...array_column($entities, 'term'), ...$this->keywords($text)])),
            'entities' => $entities,
            'proofreading' => $this->proofreading($text),
            'changesApplied' => [],
        ]);
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

    /** @param array<int, array{term: string, kind: string, aliases: string}> $terms
     *  @return array<int, array{term: string, kind: string}> */
    private function entities(string $text, array $terms): array
    {
        $normalized = mb_strtolower($text);
        $found = [];
        foreach ($terms as $term) {
            $aliases = preg_split('/[,;،]/u', $term['aliases']) ?: [];
            $candidates = array_filter(array_map('trim', [$term['term'], ...$aliases]));
            foreach ($candidates as $candidate) {
                if ($candidate !== '' && str_contains($normalized, mb_strtolower($candidate))) {
                    $found[$term['term']] = ['term' => $term['term'], 'kind' => $term['kind']];
                    break;
                }
            }
        }

        return array_values($found);
    }

    /** @return array<int, string> */
    private function keywords(string $text): array
    {
        $tokens = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text)) ?: [];
        $stop = ['هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'على', 'من', 'إلى', 'في', 'عن', 'the', 'and', 'for', 'with'];
        $counts = [];
        foreach ($tokens as $token) {
            if (mb_strlen($token) < 4 || in_array($token, $stop, true)) {
                continue;
            }
            $counts[$token] = ($counts[$token] ?? 0) + 1;
        }
        arsort($counts);

        return array_slice(array_keys($counts), 0, 5);
    }

    private function summary(string $text): string
    {
        $sentences = preg_split('/(?<=[.!؟])\s+/u', preg_replace('/\s+/u', ' ', trim($text)) ?: '') ?: [];
        $summary = trim(implode(' ', array_slice($sentences, 0, 2)));

        return mb_strlen($summary) > 360 ? mb_substr($summary, 0, 357).'…' : $summary;
    }

    /** @return array<int, array{code: string, message: string}> */
    private function proofreading(string $text): array
    {
        $issues = [];
        if (preg_match('/\s{2,}/u', $text) === 1) {
            $issues[] = ['code' => 'extra_whitespace', 'message' => 'توجد مسافات متكررة؛ راجع تنسيق النص قبل الاعتماد.'];
        }
        if (preg_match('/[!؟،.]{2,}/u', $text) === 1) {
            $issues[] = ['code' => 'repeated_punctuation', 'message' => 'توجد علامات ترقيم متتابعة؛ راجع الصياغة.'];
        }
        if ($issues === []) {
            $issues[] = ['code' => 'manual_review', 'message' => 'لا توجد ملاحظة آلية مؤكدة؛ تبقى المراجعة البشرية مطلوبة قبل النشر.'];
        }

        return $issues;
    }

    private function userId(Request $request): string
    {
        return (string) $request->attributes->get('archive_user')?->getKey();
    }
}
