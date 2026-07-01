<?php

declare(strict_types=1);

namespace App\Services\Security;

use App\Models\StorageRow;
use InvalidArgumentException;

class SecuritySettingsService
{
    // ponytail: durable overrides live in the shared storage_rows KV table (composite
    // store+uid key), so no dedicated migration is needed. Writes persist across
    // requests; config values are the defaults when no override row exists.
    private const STORE = 'security-settings';

    private const UID = 'security-settings';

    /**
     * Current effective security settings: durable safe-subset overrides merged over
     * config defaults, plus read-only deploy-time CSP/CORS values.
     *
     * @return array<string, mixed>
     */
    public function getSettings(): array
    {
        $overrides = $this->overrides();

        return [
            'accessTokenTtlMinutes' => isset($overrides['accessTokenTtlMinutes'])
                ? (int) $overrides['accessTokenTtlMinutes']
                : (int) config('archive.auth.access_ttl_minutes', 15),
            'perUserRateLimit' => isset($overrides['perUserRateLimit'])
                ? (int) $overrides['perUserRateLimit']
                : (int) config('archive.security.rate_limit_per_minute', 60),
            'webhookUrlAllowlist' => array_values($overrides['webhookUrlAllowlist'] ?? []),
            'legacyPasswordUpgrade' => isset($overrides['legacyPasswordUpgrade'])
                ? (bool) $overrides['legacyPasswordUpgrade']
                : (bool) config('archive.security.legacy_password_upgrade', false),
            // ponytail: CSP/CORS are deploy-time config only — read-only, never writable.
            'cspPolicy' => (string) config('archive.security.csp_policy', ''),
            'corsOrigins' => (array) config('archive.security.cors_origins', []),
        ];
    }

    /**
     * Update access token TTL in minutes (must be positive).
     */
    public function updateAccessTokenTtl(int $minutes): void
    {
        if ($minutes <= 0) {
            throw new InvalidArgumentException('Access token TTL must be positive.');
        }

        $this->persist(['accessTokenTtlMinutes' => $minutes]);
    }

    /**
     * Update per-user rate limit (requests per minute, must be positive).
     */
    public function updatePerUserRateLimit(int $requestsPerMinute): void
    {
        if ($requestsPerMinute <= 0) {
            throw new InvalidArgumentException('Rate limit must be positive.');
        }

        $this->persist(['perUserRateLimit' => $requestsPerMinute]);
    }

    /**
     * Update webhook URL allowlist (HTTPS only, valid URLs).
     *
     * @param  array<int, mixed>  $urls
     */
    public function updateWebhookUrlAllowlist(array $urls): void
    {
        foreach ($urls as $url) {
            if (! is_string($url) || ! $this->isValidHttpsUrl($url)) {
                throw new InvalidArgumentException(
                    'Webhook URL must be a valid HTTPS URL: '.(is_string($url) ? $url : gettype($url))
                );
            }
        }

        $this->persist(['webhookUrlAllowlist' => array_values($urls)]);
    }

    /**
     * Update legacy password upgrade flag.
     */
    public function updateLegacyPasswordUpgrade(bool $enabled): void
    {
        $this->persist(['legacyPasswordUpgrade' => $enabled]);
    }

    /**
     * Durable override map (empty when no row exists).
     *
     * @return array<string, mixed>
     */
    private function overrides(): array
    {
        $row = StorageRow::query()
            ->where('store', self::STORE)
            ->where('uid', self::UID)
            ->first();

        return is_array($row?->data) ? $row->data : [];
    }

    /**
     * Merge a patch into the durable override row (upsert).
     *
     * @param  array<string, mixed>  $patch
     */
    private function persist(array $patch): void
    {
        $merged = array_merge($this->overrides(), $patch);

        StorageRow::query()->updateOrCreate(
            ['store' => self::STORE, 'uid' => self::UID],
            ['data' => $merged],
        );
    }

    /**
     * Validate URL is HTTPS and well-formed.
     */
    private function isValidHttpsUrl(string $url): bool
    {
        $parsed = parse_url($url);

        if ($parsed === false) {
            return false;
        }

        if (($parsed['scheme'] ?? null) !== 'https') {
            return false;
        }

        return ! empty($parsed['host'] ?? null);
    }
}
