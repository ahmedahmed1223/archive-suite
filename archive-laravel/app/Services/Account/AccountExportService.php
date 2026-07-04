<?php

declare(strict_types=1);

namespace App\Services\Account;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Exports a single user's own account data. Every query is scoped by that
 * user's id/email — never call this with any id other than the requesting
 * user's own.
 */
class AccountExportService
{
    /**
     * @return array<string, mixed>
     */
    public function exportFor(User $user): array
    {
        $userId = (string) $user->getKey();

        return [
            'user' => [
                'id' => $user->getKey(),
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'createdAt' => optional($user->created_at)->toIso8601String(),
            ],
            'savedSearches' => DB::table('saved_searches')
                ->where('user_id', $userId)
                ->orderBy('created_at')
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all(),
            'recordNotes' => DB::table('record_notes')
                ->where('author_id', $userId)
                ->orderBy('created_at')
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all(),
            'recordComments' => DB::table('record_comments')
                ->where('author_id', $userId)
                ->orderBy('created_at')
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all(),
            'uploadLinks' => DB::table('upload_links')
                ->where('created_by', $userId)
                ->orderBy('created_at')
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all(),
            'intakeTemplates' => DB::table('intake_templates')
                ->where('created_by', $userId)
                ->orderBy('created_at')
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all(),
            'exportedAt' => now()->toIso8601String(),
        ];
    }
}
