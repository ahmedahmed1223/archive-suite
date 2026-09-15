<?php

declare(strict_types=1);

namespace App\Services\MaterialStages;

use Illuminate\Support\Facades\DB;
use stdClass;

final class MaterialStagesService
{
    /**
     * Derive stage from record state.
     * Priority: tech_check_failed > processing_failed > awaiting_peer >
     * incomplete_description > missing_rights > new_receipt > completed_today > ready_for_approval
     */
    public static function deriveStage(array $recordData, ?stdClass $failedJob, ?stdClass $inReview, bool $hasRights): string
    {
        if ($failedJob !== null) {
            return 'tech_check_failed';
        }
        if ($inReview !== null) {
            return 'awaiting_peer';
        }

        $descriptorStatus = $recordData['descriptorCompletion']['status'] ?? null;
        if ($descriptorStatus === 'red') {
            return 'incomplete_description';
        }

        if (! $hasRights) {
            return 'missing_rights';
        }

        $createdAt = strtotime($recordData['createdAt'] ?? 'now');
        if ($createdAt && (time() - $createdAt) < 86400) {
            return 'new_receipt';
        }

        $updatedAt = strtotime($recordData['updatedAt'] ?? 'now');
        $today = strtotime(date('Y-m-d'));
        if ($updatedAt && $updatedAt >= $today && $descriptorStatus !== 'red' && $hasRights) {
            return 'completed_today';
        }

        return 'ready_for_approval';
    }

    /**
     * Get records grouped by material stages.
     * ONE efficient query + stage derivation in PHP.
     *
     * @return array{ok: bool, records: list<array>, stageCounts: array<string, int>, nextCursor: ?string}
     */
    public function getStageGrouped(string $store, ?string $filterStage = null, ?string $cursor = null, int $limit = 50): array
    {
        // Single paginated query fetching all joined data at once
        $cursorUid = $cursor ? base64_decode($cursor, true) : null;

        $query = DB::table('storage_rows as sr')
            ->select('sr.uid', 'sr.store', 'sr.data', 'sr.created_at', 'sr.updated_at')
            ->leftJoin(
                DB::raw('(SELECT DISTINCT record_id FROM media_jobs WHERE status IN ("failed", "error", "cancelled")) as failed_jobs'),
                'sr.uid',
                '=',
                'failed_jobs.record_id'
            )
            ->leftJoin(
                DB::raw('(SELECT DISTINCT record_id FROM review_sessions WHERE status != "completed") as in_review'),
                'sr.uid',
                '=',
                'in_review.record_id'
            )
            ->leftJoin(
                DB::raw('(SELECT DISTINCT item_id FROM rights_records) as rights'),
                'sr.uid',
                '=',
                'rights.item_id'
            )
            ->where('sr.store', '=', $store)
            ->orderBy('sr.uid', 'desc');

        if ($cursorUid !== null) {
            $query->where('sr.uid', '<', $cursorUid);
        }

        $rows = $query->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $pageRows = $rows->take($limit);

        // Derive stages in PHP
        $stageCounts = array_fill_keys([
            'new_receipt',
            'tech_check_failed',
            'incomplete_description',
            'missing_rights',
            'ready_for_approval',
            'processing_failed',
            'awaiting_peer',
            'completed_today',
        ], 0);

        $records = [];
        foreach ($pageRows as $row) {
            $data = is_string($row->data) ? json_decode($row->data, true) : $row->data;
            $stage = self::deriveStage($data, $row->failed_jobs, $row->in_review, (bool) $row->item_id);

            if ($filterStage === null || $filterStage === $stage) {
                $records[] = [
                    'id' => $row->uid,
                    'uid' => $row->uid,
                    'title' => $data['title'] ?? '',
                    'stage' => $stage,
                    'createdAt' => $row->created_at,
                    'updatedAt' => $row->updated_at,
                ];
            }

            $stageCounts[$stage]++;
        }

        return [
            'ok' => true,
            'records' => $records,
            'stageCounts' => $stageCounts,
            'nextCursor' => $hasMore && $pageRows->isNotEmpty() ? base64_encode((string) $pageRows->last()?->uid) : null,
        ];
    }
}
