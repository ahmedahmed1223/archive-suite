<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SuggestionFeedback;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use stdClass;

class SuggestionsController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    /** @var array<int, string> */
    private const CONTEXTS = ['discover', 'search', 'detail'];

    /** @var array<int, string> */
    private const FEEDBACK_VALUES = ['useful', 'not-useful', 'dismissed'];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'context' => ['nullable', 'string', Rule::in(self::CONTEXTS)],
            'recordId' => ['nullable', 'string', 'max:255'],
        ]);
        $context = (string) ($validated['context'] ?? 'discover');
        $records = $this->archiveRecords();

        if ($context === 'detail') {
            $recordId = trim((string) ($validated['recordId'] ?? ''));
            if ($recordId === '') {
                return response()->json(['ok' => false, 'error' => 'recordId is required for detail suggestions.', 'code' => 'record_id_required'], 422);
            }

            $record = $this->findRecord($records, $recordId);
            if (! $record) {
                return response()->json(['ok' => false, 'error' => 'Archive record not found.', 'code' => 'record_not_found'], 404);
            }

            $suggestions = $this->detailSuggestions($record);
        } else {
            $suggestions = $this->archiveSuggestions($records, $context);
        }

        $dismissed = SuggestionFeedback::query()
            ->where('user_id', $this->userId($request))
            ->where('value', 'dismissed')
            ->pluck('suggestion_key')
            ->all();

        return response()->json([
            'ok' => true,
            'context' => $context,
            'suggestions' => array_values(array_filter(
                $suggestions,
                fn (array $suggestion): bool => ! in_array($suggestion['key'], $dismissed, true)
            )),
        ]);
    }

    public function feedback(Request $request, string $key): JsonResponse
    {
        $validated = $request->validate([
            'value' => ['required', 'string', Rule::in(self::FEEDBACK_VALUES)],
            'context' => ['nullable', 'string', Rule::in(self::CONTEXTS)],
        ]);
        $key = trim($key);

        if ($key === '') {
            return response()->json(['ok' => false, 'error' => 'Suggestion key is required.', 'code' => 'suggestion_key_required'], 422);
        }

        $feedback = SuggestionFeedback::query()->firstOrNew([
            'user_id' => $this->userId($request),
            'suggestion_key' => $key,
        ]);
        if (! $feedback->exists) {
            $feedback->id = (string) Str::uuid();
            $feedback->metadata = null;
        }
        $feedback->context = (string) ($validated['context'] ?? strtok($key, ':') ?: 'discover');
        $feedback->value = $validated['value'];
        $feedback->save();

        return response()->json([
            'ok' => true,
            'feedback' => [
                'key' => $feedback->suggestion_key,
                'context' => $feedback->context,
                'value' => $feedback->value,
                'updatedAt' => $feedback->updated_at,
            ],
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function archiveRecords(): array
    {
        return DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->orderByDesc('updated_at')
            ->limit(500)
            ->get()
            ->map(fn (stdClass $row): array => StorageRowPayload::format($row))
            ->values()
            ->all();
    }

    /** @param array<int, array<string, mixed>> $records
     *  @return array<int, array<string, mixed>> */
    private function archiveSuggestions(array $records, string $context): array
    {
        $suggestions = [];
        $missingTags = array_filter($records, fn (array $record): bool => ! isset($record['tags']) || ! is_array($record['tags']) || count($record['tags']) === 0);
        if (count($missingTags) > 0) {
            $suggestions[] = $this->suggestion("{$context}:missing-tags", 'وسِم المواد غير الموسومة', count($missingTags).' مادة بلا وسوم، ما يضعف البحث والعلاقات المقترحة.', $this->severity(count($missingTags)), count($missingTags), '/archive');
        }

        $missingTypes = array_filter($records, fn (array $record): bool => trim((string) ($record['type'] ?? '')) === '');
        if (count($missingTypes) > 0) {
            $suggestions[] = $this->suggestion("{$context}:missing-type", 'صنّف المواد بلا نوع', count($missingTypes).' مادة تحتاج نوع محتوى حتى تعمل التصفية والتنظيم بدقة.', $this->severity(count($missingTypes)), count($missingTypes), '/archive');
        }

        $titleCounts = [];
        foreach ($records as $record) {
            $title = mb_strtolower(trim((string) ($record['title'] ?? '')));
            if ($title !== '') {
                $titleCounts[$title] = ($titleCounts[$title] ?? 0) + 1;
            }
        }
        $duplicateCount = array_sum(array_filter($titleCounts, fn (int $count): bool => $count > 1));
        if ($duplicateCount > 0) {
            $suggestions[] = $this->suggestion("{$context}:duplicate-title", 'راجع العناوين المتكررة', $duplicateCount.' مادة تتشارك عنواناً مع مادة أخرى وقد تحتاج مراجعة للتكرار أو التمييز.', $this->severity($duplicateCount), $duplicateCount, '/archive');
        }

        return $suggestions;
    }

    /** @param array<string, mixed> $record
     *  @return array<int, array<string, mixed>> */
    private function detailSuggestions(array $record): array
    {
        $id = (string) ($record['id'] ?? $record['uid'] ?? '');
        $suggestions = [];
        $rules = [
            'missing-description' => [trim((string) ($record['description'] ?? '')) === '', 'أضف وصفاً للمادة', 'الوصف يجعل البحث والمراجعة وفهم سياق المادة أسرع.'],
            'missing-tags' => [! isset($record['tags']) || ! is_array($record['tags']) || count($record['tags']) === 0, 'أضف وسوماً', 'الوسوم تحسن التصفية والمواد المرتبطة في الأرشيف.'],
            'missing-type' => [trim((string) ($record['type'] ?? '')) === '', 'حدّد نوع المحتوى', 'النوع مطلوب لتنظيم المواد واستخدام فلاتر دقيقة.'],
            'missing-source' => [$this->missingSource($record), 'أضف مصدر الملف', 'لا يوجد مسار أو رابط مصدر واضح، وقد تتعذر المعاينة أو التصدير.'],
        ];

        foreach ($rules as $rule => [$matches, $title, $detail]) {
            if ($matches) {
                $suggestions[] = $this->suggestion("detail:{$id}:{$rule}", $title, $detail, 'medium', 1, '/archive/'.rawurlencode($id));
            }
        }

        return $suggestions;
    }

    /** @param array<string, mixed> $record */
    private function missingSource(array $record): bool
    {
        $metadata = is_array($record['metadata'] ?? null) ? $record['metadata'] : [];

        return trim((string) ($record['path'] ?? $record['filePath'] ?? $record['url'] ?? $metadata['localFile'] ?? $metadata['fileKey'] ?? $metadata['storageKey'] ?? '')) === '';
    }

    /** @param array<int, array<string, mixed>> $records
     *  @return array<string, mixed>|null */
    private function findRecord(array $records, string $recordId): ?array
    {
        foreach ($records as $record) {
            if ((string) ($record['id'] ?? '') === $recordId || (string) ($record['uid'] ?? '') === $recordId) {
                return $record;
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    private function suggestion(string $key, string $title, string $detail, string $severity, int $count, string $actionHref): array
    {
        return compact('key', 'title', 'detail', 'severity', 'count', 'actionHref');
    }

    private function severity(int $count): string
    {
        return $count >= 5 ? 'high' : 'medium';
    }

    private function userId(Request $request): string
    {
        return (string) $request->attributes->get('archive_user')?->getKey();
    }
}
