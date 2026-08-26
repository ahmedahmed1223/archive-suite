<?php

namespace App\Policies;

use App\Models\MontageExport;
use App\Models\User;

class MontageExportPolicy
{
    public function view(User $user, MontageExport $export): bool
    {
        $project = $export->project;

        return $project !== null && app(MontageProjectPolicy::class)->view($user, $project);
    }

    public function cancel(User $user, MontageExport $export): bool
    {
        return $this->mayControl($user, $export);
    }

    public function retry(User $user, MontageExport $export): bool
    {
        return $this->mayControl($user, $export);
    }

    private function mayControl(User $user, MontageExport $export): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        if ($user->role !== 'editor') {
            return false;
        }

        $userId = (string) $user->getKey();

        return (string) $export->requested_by === $userId
            || ($export->project?->owner_id !== null
                && (string) $export->project->owner_id === $userId);
    }
}
