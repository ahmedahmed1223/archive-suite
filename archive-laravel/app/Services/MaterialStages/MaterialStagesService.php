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
            // An inspection that failed and a transcode that failed are
            // different desks. Both stages were listed, but everything landed
            // on the first one, so processing_failed could never appear.
            $operation = is_string($failedJob->operation ?? null) ? $failedJob->operation : null;

            return in_array($operation, ['media_probe', 'media_qc'], true) || $operation === null
                ? 'tech_check_failed'
                : 'processing_failed';
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

        // The joined columns have to be selected to be readable: without them
        // every row read undefined properties, which answered 500 and -- when
        // it did not -- derived every record's stage from three empty values.
        // Single-quoted literals so the subqueries mean the same thing on
        // SQLite as on MySQL, where double quotes are identifiers.
        $query = DB::table('storage_rows as sr')
            ->select(
                'sr.uid',
                'sr.store',
                'sr.data',
                'sr.created_at',
                'sr.updated_at',
                'failed_jobs.record_id as failed_job_record_id',
                'failed_jobs.operation as failed_job_operation',
                'in_review.record_uid as in_review_record_uid',
                'rights.item_id as rights_item_id',
            )
            ->leftJoin(
                DB::raw("(SELECT record_id, MIN(operation) as operation FROM media_jobs WHERE status IN ('failed', 'error', 'cancelled') GROUP BY record_id) as failed_jobs"),
                'sr.uid',
                '=',
                'failed_jobs.record_id'
            )
            // review_sessions keys on record_uid and state, not record_id and
            // status: the old subquery named two columns that do not exist, so
            // the whole query failed and no material could ever read as being
            // with a colleague. "Open" is the states before a verdict.
            ->leftJoin(
                DB::raw("(SELECT DISTINCT record_uid FROM review_sessions WHERE state IN ('draft', 'in_review', 'changes_requested')) as in_review"),
                'sr.uid',
                '=',
                'in_review.record_uid'
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
            $failedJob = $row->failed_job_record_id === null ? null : (object) [
                'record_id' => $row->failed_job_record_id,
                'operation' => $row->failed_job_operation,
            ];
            $inReview = $row->in_review_record_uid === null ? null : (object) ['record_uid' => $row->in_review_record_uid];
            $stage = self::deriveStage($data, $failedJob, $inReview, $row->rights_item_id !== null);

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
