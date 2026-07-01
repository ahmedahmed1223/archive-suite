<?php

namespace Tests\Unit;

use App\Services\Security\SecuritySettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecuritySettingsServiceTest extends TestCase
{
    use RefreshDatabase;

    private SecuritySettingsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(SecuritySettingsService::class);
    }

    public function test_it_returns_default_security_settings(): void
    {
        $settings = $this->service->getSettings();

        $this->assertIsArray($settings);
        $this->assertArrayHasKey('accessTokenTtlMinutes', $settings);
        $this->assertArrayHasKey('perUserRateLimit', $settings);
        $this->assertArrayHasKey('webhookUrlAllowlist', $settings);
        $this->assertArrayHasKey('legacyPasswordUpgrade', $settings);
        $this->assertArrayHasKey('cspPolicy', $settings);
        $this->assertArrayHasKey('corsOrigins', $settings);
    }

    public function test_it_returns_access_token_ttl_from_config(): void
    {
        config(['archive.auth.access_ttl_minutes' => 30]);

        $settings = $this->service->getSettings();

        $this->assertSame(30, $settings['accessTokenTtlMinutes']);
    }

    public function test_it_returns_per_user_rate_limit_from_config(): void
    {
        config(['archive.security.rate_limit_per_minute' => 60]);

        $settings = $this->service->getSettings();

        $this->assertSame(60, $settings['perUserRateLimit']);
    }

    public function test_it_returns_webhook_url_allowlist_from_storage(): void
    {
        $urls = ['https://webhook.example.com', 'https://api.example.org'];
        $this->service->updateWebhookUrlAllowlist($urls);

        $settings = $this->service->getSettings();

        $this->assertSame($urls, $settings['webhookUrlAllowlist']);
    }

    public function test_it_defaults_webhook_url_allowlist_to_empty_array(): void
    {
        $settings = $this->service->getSettings();

        $this->assertSame([], $settings['webhookUrlAllowlist']);
    }

    public function test_it_returns_legacy_password_upgrade_flag(): void
    {
        config(['archive.security.legacy_password_upgrade' => true]);

        $settings = $this->service->getSettings();

        $this->assertTrue($settings['legacyPasswordUpgrade']);
    }

    public function test_update_access_token_ttl_with_valid_value(): void
    {
        $this->service->updateAccessTokenTtl(45);

        $settings = $this->service->getSettings();

        $this->assertSame(45, $settings['accessTokenTtlMinutes']);
    }

    public function test_update_access_token_ttl_rejects_zero(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->service->updateAccessTokenTtl(0);
    }

    public function test_update_access_token_ttl_rejects_negative(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->service->updateAccessTokenTtl(-5);
    }

    public function test_update_per_user_rate_limit_with_valid_value(): void
    {
        $this->service->updatePerUserRateLimit(120);

        $settings = $this->service->getSettings();

        $this->assertSame(120, $settings['perUserRateLimit']);
    }

    public function test_update_per_user_rate_limit_rejects_zero(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->service->updatePerUserRateLimit(0);
    }

    public function test_update_webhook_url_allowlist_with_valid_https_urls(): void
    {
        $urls = ['https://webhook.example.com', 'https://api.example.org'];

        $this->service->updateWebhookUrlAllowlist($urls);

        $settings = $this->service->getSettings();

        $this->assertSame($urls, $settings['webhookUrlAllowlist']);
    }

    public function test_update_webhook_url_allowlist_rejects_http_url(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->service->updateWebhookUrlAllowlist(['http://webhook.example.com']);
    }

    public function test_update_webhook_url_allowlist_rejects_invalid_url(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->service->updateWebhookUrlAllowlist(['not-a-url']);
    }

    public function test_update_webhook_url_allowlist_accepts_empty_array(): void
    {
        $this->service->updateWebhookUrlAllowlist([]);

        $settings = $this->service->getSettings();

        $this->assertSame([], $settings['webhookUrlAllowlist']);
    }

    public function test_update_legacy_password_upgrade_flag(): void
    {
        $this->service->updateLegacyPasswordUpgrade(true);

        $settings = $this->service->getSettings();

        $this->assertTrue($settings['legacyPasswordUpgrade']);
    }

    public function test_csp_policy_is_read_only(): void
    {
        config(['archive.security.csp_policy' => "default-src 'self';"]);

        $settings = $this->service->getSettings();

        $this->assertStringContainsString("default-src 'self';", $settings['cspPolicy']);
    }

    public function test_cors_origins_are_read_only(): void
    {
        config(['archive.security.cors_origins' => ['https://example.com', 'https://app.example.com']]);

        $settings = $this->service->getSettings();

        $this->assertSame(['https://example.com', 'https://app.example.com'], $settings['corsOrigins']);
    }
}
