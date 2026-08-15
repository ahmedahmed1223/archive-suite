<?php

declare(strict_types=1);

namespace App\Services\Settings;

use App\Models\CapabilitySetting;
use App\Models\User;
use App\Services\Search\EmbeddingService;
use Illuminate\Support\Facades\DB;

class CapabilitySettingsService
{
    public function __construct(private readonly EmbeddingService $embeddings) {}

    /**
     * @return array<string, array{value: bool, source: string, editable: bool, status: string, reason: ?string}>
     */
    public function capabilities(?User $actor = null): array
    {
        $result = [];

        foreach ($this->definitions() as $key => $definition) {
            $result[$key] = $this->effectiveSetting($key, $definition, $actor);
        }

        return $result;
    }

    /**
     * @param  array<string, bool>  $values
     */
    public function update(array $values, User $actor): void
    {
        $definitions = $this->definitions();

        DB::transaction(function () use ($values, $actor, $definitions): void {
            foreach ($values as $key => $value) {
                $definition = $definitions[$key];

                if (! ($definition['adminEditable'] ?? false)) {
                    throw new LockedSettingException(
                        (string) ($definition['source'] ?? 'release'),
                        "The {$key} capability is not editable.",
                    );
                }

                if (! $this->deploymentAllows($key, $definition)) {
                    throw new LockedSettingException('deployment', (string) $definition['unavailableReason']);
                }

                $setting = CapabilitySetting::query()->find($key);

                CapabilitySetting::query()->updateOrCreate(
                    ['key' => $key],
                    [
                        'value' => $value,
                        'version' => ($setting?->version ?? 0) + 1,
                        'updated_by_user_id' => $actor->getKey(),
                    ],
                );
            }
        });
    }

    public function isEnabled(string $key): bool
    {
        $definition = $this->definitions()[$key] ?? null;

        if (! is_array($definition)) {
            return false;
        }

        return $this->effectiveSetting($key, $definition, null)['value'];
    }

    /** @return array<string, array<string, mixed>> */
    private function definitions(): array
    {
        return (array) config('archive-settings.capabilities', []);
    }

    /**
     * @param  array<string, mixed>  $definition
     * @return array{value: bool, source: string, editable: bool, status: string, reason: ?string}
     */
    private function effectiveSetting(string $key, array $definition, ?User $actor): array
    {
        $deploymentAllows = $this->deploymentAllows($key, $definition);
        $override = $deploymentAllows && ($definition['adminEditable'] ?? false)
            ? CapabilitySetting::query()->find($key)
            : null;
        $value = ($definition['adminEditable'] ?? false)
            ? $deploymentAllows && (bool) ($override?->value ?? $definition['default'])
            : $deploymentAllows;
        $source = $override ? 'system' : (string) ($definition['source'] ?? 'release');
        $editable = $deploymentAllows
            && (bool) ($definition['adminEditable'] ?? false)
            && $actor?->role === 'admin';

        if (! $deploymentAllows) {
            $status = (string) ($definition['unavailableStatus'] ?? 'unavailable');
            $reason = (string) ($definition['unavailableReason'] ?? 'Unavailable in this deployment.');
        } elseif (! $value) {
            $status = 'disabled';
            $reason = $override ? 'Disabled by an administrator.' : 'Disabled by default.';
        } else {
            $status = 'enabled';
            $reason = null;
        }

        return compact('value', 'source', 'editable', 'status', 'reason');
    }

    /** @param array<string, mixed> $definition */
    private function deploymentAllows(string $key, array $definition): bool
    {
        if ($key === 'semanticSearch') {
            return $this->embeddings->isEnabled();
        }

        $required = $definition['requiresCapability'] ?? null;

        if (is_string($required) && $required !== '' && ! $this->isEnabled($required)) {
            return false;
        }

        if (($definition['source'] ?? null) === 'release') {
            return (bool) $definition['default'];
        }

        $configured = config((string) $definition['config']);

        if (array_key_exists('enabledValue', $definition)) {
            return $configured === $definition['enabledValue'];
        }

        if ($definition['nonEmpty'] ?? false) {
            return is_string($configured) && trim($configured) !== '';
        }

        return (bool) $configured;
    }
}
