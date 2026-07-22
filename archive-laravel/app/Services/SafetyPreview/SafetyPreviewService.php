<?php

declare(strict_types=1);

namespace App\Services\SafetyPreview;

use Illuminate\Support\Carbon;

class SafetyPreviewService
{
    /** @return array<int, array{id: string, description: string}> */
    public function scenarios(): array
    {
        return [
            ['id' => 'bulk-delete-basic', 'description' => 'حذف جماعي تجريبي لسجلات اصطناعية'],
            ['id' => 'restore-conflict', 'description' => 'استعادة تجريبية تعرض تعارضاً وعنصراً قابلاً للاستعادة'],
        ];
    }

    /** @return array<int, string> */
    public function scenarioIds(): array
    {
        return array_column($this->scenarios(), 'id');
    }

    /**
     * Runs entirely against fresh local arrays. It must never touch archive data.
     *
     * @param array<int, string> $ids
     * @return array<string, mixed>
     */
    public function run(string $scenario, string $operation, array $ids): array
    {
        [$live, $trash] = $this->fixtures($scenario);
        $before = ['live' => count($live), 'trash' => count($trash)];
        $results = [];

        foreach (array_values(array_unique($ids, SORT_STRING)) as $id) {
            if ($operation === 'delete') {
                if (! isset($live[$id])) {
                    $results[] = ['id' => $id, 'deleted' => false, 'reason' => 'not_found'];
                    continue;
                }

                $trash[$id] = $live[$id];
                unset($live[$id]);
                $results[] = ['id' => $id, 'deleted' => true];
                continue;
            }

            if (! isset($trash[$id])) {
                $results[] = ['id' => $id, 'restored' => false, 'reason' => 'not_found'];
                continue;
            }
            if (isset($live[$id])) {
                $results[] = ['id' => $id, 'restored' => false, 'reason' => 'conflict'];
                continue;
            }

            $live[$id] = $trash[$id];
            unset($trash[$id]);
            $results[] = ['id' => $id, 'restored' => true];
        }

        return [
            'scenario' => $scenario,
            'operation' => $operation,
            'expiresAt' => Carbon::now()->addMinutes(15)->toIso8601String(),
            'before' => $before,
            'after' => ['live' => count($live), 'trash' => count($trash)],
            'results' => $results,
        ];
    }

    /** @return array{0: array<string, array{uid: string}>, 1: array<string, array{uid: string}>} */
    private function fixtures(string $scenario): array
    {
        if ($scenario === 'restore-conflict') {
            return [
                ['conflict' => ['uid' => 'conflict']],
                ['conflict' => ['uid' => 'conflict'], 'recoverable' => ['uid' => 'recoverable']],
            ];
        }

        return [
            ['alpha' => ['uid' => 'alpha'], 'bravo' => ['uid' => 'bravo'], 'charlie' => ['uid' => 'charlie']],
            [],
        ];
    }
}
