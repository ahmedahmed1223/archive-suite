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
     * @param  array<string, int>  $expectedVersions  Optional per-key optimistic-concurrency
     *   check: when a key is present, the update is rejected with a
     *   CapabilityVersionConflictException if the stored version has moved on since the
     *   caller read it (e.g. another admin changed it first).
     */
    public function update(array $values, User $actor, array $expectedVersions = []): void
    {
        $definitions = $this->definitions();

        DB::transaction(function () use ($values, $actor, $definitions, $expectedVersions): void {
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
                $currentVersion = $setting?->version ?? 0;

                if (array_key_exists($key, $expectedVersions) && $expectedVersions[$key] !== $currentVersion) {
                    throw new CapabilityVersionConflictException($key, $currentVersion);
                }

                CapabilitySetting::query()->updateOrCreate(
                    ['key' => $key],
                    [
                        'value' => $value,
                        'version' => $currentVersion + 1,
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
     * Resolves the effective value through a fixed precedence chain: the
     * deployment/rollout flag gates availability first, an admin policy
     * override (`CapabilitySetting`) takes the next say, and the release
     * default is the final fallback.
     *
     * ponytail: no capability currently sets `userOverridable`, so a
     * per-user-preference layer below the admin policy has no consumer yet
     * — add a `user_capability_overrides` table (and a layer here, above
     * default) when the first one needs it, instead of pre-building unused
     * schema. Same for session-scoped grants: no capability opts in today.
     *
     * @param  array<string, mixed>  $definition
     * @return array{value: bool, source: string, editable: bool, status: string, reason: ?string, version: int}
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

        $version = $override?->version ?? 0;

        return compact('value', 'source', 'editable', 'status', 'reason', 'version');
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
