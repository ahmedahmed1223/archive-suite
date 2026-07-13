<?php

declare(strict_types=1);

namespace App\Services\System;

use App\Services\Backup\BackupService;
use App\Support\ApiError;
use Illuminate\Support\Facades\Artisan;

/**
 * Host control actions (clear cache, trigger backup, ...). This is the
 * highest-risk surface in the app: every action is a no-op unless
 * `archive.system_control_enabled` (env: SYSTEM_CONTROL_ENABLED) is true.
 * The gate is enforced here, not just hidden in the UI, so a direct API
 * call cannot bypass it. Callers must also be admin-checked before this
 * service is ever reached (see SystemControlController).
 */
class SystemControlService
{
    /**
     * @var array<string, string>
     */
    private const ACTIONS = [
        'clear-cache' => 'Clear application cache',
        'run-backup' => 'Trigger an immediate backup',
    ];

    public function __construct(private readonly BackupService $backups)
    {
    }

    public function isEnabled(): bool
    {
        return (bool) config('archive.system_control_enabled', false);
    }

    /**
     * @return array<string, string>
     */
    public function availableActions(): array
    {
        return self::ACTIONS;
    }

    /**
     * @return array{action: string, detail: array<string, mixed>}
     */
    public function run(string $action): array
    {
        if (! $this->isEnabled()) {
            throw new SystemControlException('System control actions are disabled.', 503, apiCode: ApiError::SYSTEM_CONTROL_DISABLED);
        }

        if (! array_key_exists($action, self::ACTIONS)) {
            throw new SystemControlException('Unknown system control action.', 422);
        }

        $detail = match ($action) {
            'clear-cache' => $this->clearCache(),
            'run-backup' => $this->backups->run(),
            default => throw new SystemControlException('Unknown system control action.', 422),
        };

        return ['action' => $action, 'detail' => $detail];
    }

    /**
     * @return array{cleared: list<string>}
     */
    private function clearCache(): array
    {
        Artisan::call('cache:clear');
        Artisan::call('config:clear');

        return ['cleared' => ['cache', 'config']];
    }
}
