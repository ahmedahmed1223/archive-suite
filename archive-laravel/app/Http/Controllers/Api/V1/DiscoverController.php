<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use stdClass;

class DiscoverController extends Controller
{
    private const ARCHIVE_STORE = 'archive-items';

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:24'],
        ]);

        $limit = (int) ($validated['limit'] ?? 8);
        $records = DB::table('storage_rows')
            ->where('store', self::ARCHIVE_STORE)
            ->orderByDesc('updated_at')
            ->limit(500)
            ->get()
            ->map(fn (stdClass $row): array => StorageRowPayload::format($row))
            ->values()
            ->all();

        $activityCounts = $this->activityCounts();

        return response()->json([
            'ok' => true,
            'sections' => [
                $this->section(
                    'explore',
                    'استكشف',
                    'مواد جديدة ومكتملة تساعدك على بدء العمل بسرعة.',
                    $this->explore($records),
                    $limit
                ),
                $this->section(
                    'trending',
                    'رائجة',
                    'سجلات ذات نشاط حديث أو تعديل قريب.',
                    $this->trending($records, $activityCounts),
                    $limit
                ),
                $this->section(
                    'random',
                    'عشوائية',
                    'عينة يومية لكسر نمط العمل المعتاد.',
                    $this->dailyRandom($records),
                    $limit
                ),
                $this->section(
                    'active',
                    'الأكثر نشاطا',
                    'مواد لديها نشاط أو تعديل حديث.',
                    $this->active($records, $activityCounts),
                    $limit
                ),
                $this->section(
                    'forgotten',
                    'المنسيون',
                    'عناصر بلا نشاط حديث وتستحق مراجعة.',
                    $this->forgotten($records, $activityCounts),
                    $limit
                ),
                $this->section(
                    'needsMetadata',
                    'تحتاج استكمال بيانات',
                    'عناصر ينقصها وصف أو نوع أو وسوم.',
                    $this->needsMetadata($records),
                    $limit
                ),
            ],
        ]);
    }

    /**
     * @return array<string, int>
     */
    private function activityCounts(): array
    {
        return DB::table('audit_logs')
            ->select('resource_id', DB::raw('count(*) as aggregate'))
            ->where('resource_type', 'record')
            ->whereNotNull('resource_id')
            ->where('created_at', '>=', now()->subDays(14))
            ->groupBy('resource_id')
            ->pluck('aggregate', 'resource_id')
            ->map(fn (mixed $value): int => (int) $value)
            ->all();
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @return array<int, array<string, mixed>>
     */
    private function explore(array $records): array
    {
        usort($records, function (array $left, array $right): int {
            return $this->exploreScore($right) <=> $this->exploreScore($left);
        });

        return $records;
    }

    /**
     * @param array<string, mixed> $record
     */
    private function exploreScore(array $record): int
    {
        $favoriteBoost = ($record['isFavorite'] ?? false) === true ? 250 : 0;

        return $this->timestamp($record) + ($this->metadataCompleteness($record) * 100) + $favoriteBoost;
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @param array<string, int> $activityCounts
     * @return array<int, array<string, mixed>>
     */
    private function trending(array $records, array $activityCounts): array
    {
        usort($records, function (array $left, array $right) use ($activityCounts): int {
            return $this->trendingScore($right, $activityCounts) <=> $this->trendingScore($left, $activityCounts);
        });

        return $records;
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, int> $activityCounts
     */
    private function trendingScore(array $record, array $activityCounts): int
    {
        $id = (string) ($record['id'] ?? $record['uid'] ?? '');
        $uid = (string) ($record['uid'] ?? $id);
        $activity = max($activityCounts[$id] ?? 0, $activityCounts[$uid] ?? 0);
        $updatedAt = $this->timestamp($record);
        $ageDays = $updatedAt > 0 ? (int) floor(max(0, time() - $updatedAt) / 86400) : 999;
        $recency = max(0, 30 - $ageDays);
        $metadataBonus = $this->metadataCompleteness($record);

        return ($activity * 100) + ($recency * 3) + $metadataBonus;
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @param array<string, int> $activityCounts
     * @return array<int, array<string, mixed>>
     */
    private function active(array $records, array $activityCounts): array
    {
        usort($records, function (array $left, array $right) use ($activityCounts): int {
            return $this->activityScore($right, $activityCounts) <=> $this->activityScore($left, $activityCounts)
                ?: $this->timestamp($right) <=> $this->timestamp($left);
        });

        return $records;
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @param array<string, int> $activityCounts
     * @return array<int, array<string, mixed>>
     */
    private function forgotten(array $records, array $activityCounts): array
    {
        $forgotten = array_values(array_filter(
            $records,
            fn (array $record): bool => $this->activityScore($record, $activityCounts) === 0 && $this->ageDays($record) >= 14
        ));

        return $this->sortByTimestamp(count($forgotten) > 0 ? $forgotten : $records, descending: false);
    }

    /**
     * @param array<string, mixed> $record
     * @param array<string, int> $activityCounts
     */
    private function activityScore(array $record, array $activityCounts): int
    {
        $id = (string) ($record['id'] ?? $record['uid'] ?? '');
        $uid = (string) ($record['uid'] ?? $id);

        return max($activityCounts[$id] ?? 0, $activityCounts[$uid] ?? 0);
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @return array<int, array<string, mixed>>
     */
    private function sortByTimestamp(array $records, bool $descending): array
    {
        usort($records, function (array $left, array $right) use ($descending): int {
            $comparison = $this->timestamp($left) <=> $this->timestamp($right);

            return $descending ? -$comparison : $comparison;
        });

        return $records;
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @return array<int, array<string, mixed>>
     */
    private function needsMetadata(array $records): array
    {
        $records = array_values(array_filter(
            $records,
            fn (array $record): bool => $this->missingMetadataScore($record) > 0
        ));

        usort($records, function (array $left, array $right): int {
            return $this->missingMetadataScore($right) <=> $this->missingMetadataScore($left)
                ?: $this->timestamp($right) <=> $this->timestamp($left);
        });

        return $records;
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @return array<int, array<string, mixed>>
     */
    private function dailyRandom(array $records): array
    {
        $seed = now()->format('Y-m-d');

        usort($records, function (array $left, array $right) use ($seed): int {
            return crc32($seed.($left['uid'] ?? $left['id'] ?? '')) <=> crc32($seed.($right['uid'] ?? $right['id'] ?? ''));
        });

        return $records;
    }

    /**
     * @param array<int, array<string, mixed>> $records
     * @return array{key: string, label: string, description: string, count: int, records: array<int, array<string, mixed>>}
     */
    private function section(string $key, string $label, string $description, array $records, int $limit): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'description' => $description,
            'count' => count($records),
            'records' => array_slice(array_values($records), 0, $limit),
        ];
    }

    /**
     * @param array<string, mixed> $record
     */
    private function timestamp(array $record): int
    {
        $value = $record['updatedAt'] ?? $record['createdAt'] ?? null;

        if (! is_string($value) || $value === '') {
            return 0;
        }

        $timestamp = strtotime($value);

        return $timestamp === false ? 0 : $timestamp;
    }

    /**
     * @param array<string, mixed> $record
     */
    private function ageDays(array $record): int
    {
        $timestamp = $this->timestamp($record);

        return $timestamp > 0 ? (int) floor(max(0, time() - $timestamp) / 86400) : 999;
    }

    /**
     * @param array<string, mixed> $record
     */
    private function missingMetadataScore(array $record): int
    {
        $score = 0;

        if (! isset($record['title']) || trim((string) $record['title']) === '') {
            $score++;
        }

        if (! isset($record['description']) || trim((string) $record['description']) === '') {
            $score++;
        }

        if (! isset($record['type']) || trim((string) $record['type']) === '') {
            $score++;
        }

        if (! isset($record['tags']) || ! is_array($record['tags']) || count($record['tags']) === 0) {
            $score++;
        }

        return $score;
    }

    /**
     * @param array<string, mixed> $record
     */
    private function metadataCompleteness(array $record): int
    {
        return 4 - $this->missingMetadataScore($record);
    }
}
