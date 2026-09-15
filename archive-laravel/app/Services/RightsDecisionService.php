<?php

declare(strict_types=1);

namespace App\Services;

use App\Contracts\RightsDecision;
use App\Models\RightsRecord;
use Carbon\Carbon;

class RightsDecisionService
{
    public function decide(
        ?RightsRecord $record,
        string $usage,
        string $territory,
        string $platform,
        Carbon $requestTime,
    ): RightsDecision {
        // Deny by default: no rights record
        if ($record === null) {
            return new RightsDecision(
                allowed: false,
                reason: 'لا توجد بيانات حقوق مسجّلة',
                decidedBy: 'no_record',
            );
        }

        // Find windows for this usage
        $windows = $record->windows()
            ->where('usage', $usage)
            ->get();

        if ($windows->isEmpty()) {
            return new RightsDecision(
                allowed: false,
                reason: sprintf('لا توجد نافذة لهذا الاستخدام: %s', $usage),
                decidedBy: 'no_window_for_usage',
            );
        }

        // Check each window
        foreach ($windows as $window) {
            // Check if granted
            if (!$window->granted) {
                return new RightsDecision(
                    allowed: false,
                    reason: sprintf('لم تُمنح هذه النافذة: %s', $window->id),
                    decidedBy: $window->id,
                );
            }

            // Check temporal validity
            $startsAtValid = $window->starts_at === null || $window->starts_at->lte($requestTime);
            $endsAtValid = $window->ends_at === null || $window->ends_at->gte($requestTime);

            if (!$startsAtValid || !$endsAtValid) {
                continue;
            }

            // Check territory
            $windowTerritories = $window->territories ?? [];
            if (!empty($windowTerritories) && !in_array($territory, $windowTerritories, true)) {
                continue;
            }

            // Check platform
            $windowPlatforms = $window->platforms ?? [];
            if (!empty($windowPlatforms) && !in_array($platform, $windowPlatforms, true)) {
                continue;
            }

            // All checks passed
            return new RightsDecision(
                allowed: true,
                reason: sprintf('مُصرّح بالاستخدام عبر النافذة: %s', $window->id),
                decidedBy: $window->id,
            );
        }

        // No window matched all criteria
        $firstWindow = $windows->first();
        return new RightsDecision(
            allowed: false,
            reason: sprintf('النافذة %s لا تطابق المعايير (الإقليم أو المنصة أو الصلاحية الزمنية)', $firstWindow?->id ?? 'unknown'),
            decidedBy: $firstWindow?->id ?? 'unknown_window',
        );
    }
}
