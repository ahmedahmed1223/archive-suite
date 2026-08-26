<?php

namespace App\Policies;

use App\Models\MontageProject;
use App\Models\User;

class MontageProjectPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, ['admin', 'editor', 'viewer'], true);
    }

    public function view(User $user, MontageProject $project): bool
    {
        return $user->role === 'admin'
            || $project->owner_id === null
            || (string) $project->owner_id === (string) $user->getKey();
    }

    public function create(User $user): bool
    {
        return $this->canEdit($user);
    }

    public function update(User $user, MontageProject $project): bool
    {
        return $this->canEdit($user) && $this->view($user, $project);
    }

    public function saveRevision(User $user, MontageProject $project): bool
    {
        return $this->update($user, $project);
    }

    public function restoreRevision(User $user, MontageProject $project): bool
    {
        return $this->update($user, $project);
    }

    public function requestExport(User $user, MontageProject $project): bool
    {
        return $this->update($user, $project);
    }

    public function delete(User $user, MontageProject $project): bool
    {
        return $user->role === 'admin';
    }

    private function canEdit(User $user): bool
    {
        return in_array($user->role, ['admin', 'editor'], true);
    }
}
