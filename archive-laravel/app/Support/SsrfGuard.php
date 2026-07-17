<?php

declare(strict_types=1);

namespace App\Support;

/**
 * V1-759: outbound-URL guard for the webhooks feature (the only place this
 * codebase makes an admin-configured, server-initiated HTTP call to a
 * third-party host). Blocks http(s) URLs that resolve to loopback or
 * RFC1918/link-local ranges so an admin can't point a webhook at internal
 * infrastructure. Fails closed: a hostname that can't be resolved is
 * treated as unsafe rather than allowed through.
 */
final class SsrfGuard
{
    /** @var array<int, string> */
    private const BLOCKED_IPV4_RANGES = [
        '127.0.0.0/8',
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '169.254.0.0/16',
    ];

    public static function isPublicHttpUrl(string $url): bool
    {
        $parts = parse_url($url);
        $scheme = $parts['scheme'] ?? '';
        $host = $parts['host'] ?? '';

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            return false;
        }

        $ips = self::resolveIps($host);

        if ($ips === []) {
            return false;
        }

        foreach ($ips as $ip) {
            if (self::isBlockedIp($ip)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array<int, string>
     */
    private static function resolveIps(string $host): array
    {
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return [$host];
        }

        // ponytail: real DNS lookup, no rebinding-safe pinning. Good enough
        // for an admin-configured outbound URL check; add DNS pinning at
        // delivery time if rebinding attacks become a real threat model.
        $records = @dns_get_record($host, DNS_A + DNS_AAAA);

        if (! is_array($records)) {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn (array $record): ?string => $record['ip'] ?? $record['ipv6'] ?? null,
            $records,
        )));
    }

    private static function isBlockedIp(string $ip): bool
    {
        if ($ip === '::1' || str_starts_with($ip, 'fe80:')) {
            return true;
        }

        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false) {
            // Non-loopback/link-local IPv6 addresses are not in the
            // documented blocked-range set; only IPv4 RFC1918 ranges apply.
            return false;
        }

        foreach (self::BLOCKED_IPV4_RANGES as $range) {
            if (self::ipv4InRange($ip, $range)) {
                return true;
            }
        }

        return false;
    }

    private static function ipv4InRange(string $ip, string $range): bool
    {
        [$subnet, $bits] = explode('/', $range);
        $mask = -1 << (32 - (int) $bits);

        return (ip2long($ip) & $mask) === (ip2long($subnet) & $mask);
    }
}
