<?php

declare(strict_types=1);

namespace App\Services\Onboarding;

use App\Models\StorageRow;
use Illuminate\Validation\ValidationException;

class OnboardingProgressService
{
    private const STORE = 'onboarding-progress';

    private const UID = 'onboarding-progress';

    /** @var list<string> */
    private const STAGES = ['organization', 'storage', 'invitation', 'first_record', 'first_search'];

    /**
     * @return array{stages: list<array{id: string, status: string, completedAt: ?string}>}
     */
    public function progress(): array
    {
        $storedStages = StorageRow::query()
            ->where('store', self::STORE)
            ->where('uid', self::UID)
            ->value('data');
        $byId = is_array($storedStages) ? $storedStages : [];

        return [
            'stages' => array_map(function (string $id) use ($byId): array {
                $stage = is_array($byId[$id] ?? null) ? $byId[$id] : [];
                $completed = ($stage['status'] ?? 'pending') === 'completed';

                return [
                    'id' => $id,
                    'status' => $completed ? 'completed' : 'pending',
                    'completedAt' => $completed && is_string($stage['completedAt'] ?? null)
                        ? $stage['completedAt']
                        : null,
                ];
            }, self::STAGES),
        ];
    }

    /**
     * @return array{stages: list<array{id: string, status: string, completedAt: ?string}>}
     */
    public function update(string $stage, string $status): array
    {
        if (! in_array($stage, self::STAGES, true)) {
            throw ValidationException::withMessages(['stage' => ['The selected stage is invalid.']]);
        }

        $row = StorageRow::query()->firstOrNew(['store' => self::STORE, 'uid' => self::UID]);
        $stages = is_array($row->data) ? $row->data : [];
        $stages[$stage] = [
            'status' => $status,
            'completedAt' => $status === 'completed' ? now()->toIso8601String() : null,
        ];
        $row->data = $stages;
        $row->save();

        return $this->progress();
    }
}
