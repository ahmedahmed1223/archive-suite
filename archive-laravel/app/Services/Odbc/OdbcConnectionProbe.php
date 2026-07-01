<?php

namespace App\Services\Odbc;

use Throwable;

class OdbcConnectionProbe
{
    /**
     * @param  array<string, mixed>  $config
     */
    public function __construct(
        private readonly OdbcConnectionFactory $factory,
        private readonly array $config,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function probe(): array
    {
        $enabled = $this->truthy($this->config['enabled'] ?? false);
        $dsn = trim((string) ($this->config['dsn'] ?? ''));
        $drivers = $this->factory->availableDrivers();
        $driverLoaded = count($drivers) > 0;

        $base = [
            'enabled' => $enabled,
            'driverLoaded' => $driverLoaded,
            'dsn' => $this->maskSecret($dsn),
            'tables' => [],
        ];

        if (! $enabled) {
            return array_merge($base, [
                'status' => 'disabled',
                'message' => 'ODBC bridge is disabled.',
            ]);
        }

        if ($dsn === '') {
            return array_merge($base, [
                'status' => 'missing-dsn',
                'message' => 'ODBC is enabled but ODBC_DSN is empty.',
            ]);
        }

        if (! $driverLoaded) {
            return array_merge($base, [
                'status' => 'driver-unavailable',
                'message' => 'PHP ODBC extension or ODBC drivers are not available.',
            ]);
        }

        try {
            $connection = $this->factory->connect(
                $dsn,
                $this->nullableString($this->config['username'] ?? null),
                $this->nullableString($this->config['password'] ?? null),
            );

            return array_merge($base, [
                'status' => 'connected',
                'tables' => $connection->tableNames($this->tableLimit()),
            ]);
        } catch (Throwable $error) {
            return array_merge($base, [
                'status' => 'failed',
                'error' => $this->sanitizeError($error->getMessage()),
            ]);
        }
    }

    private function tableLimit(): int
    {
        return max(1, min((int) ($this->config['table_limit'] ?? 25), 250));
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function sanitizeError(string $message): string
    {
        $message = $this->maskSecret($message);
        $password = $this->nullableString($this->config['password'] ?? null);

        if ($password !== null) {
            $message = str_replace($password, '***', $message);
        }

        return $message;
    }

    private function maskSecret(string $value): string
    {
        return preg_replace('/\b(PWD|Password)\s*=\s*([^;]+)/i', '$1=***', $value) ?? $value;
    }

    private function truthy(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_string($value)) {
            return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
        }

        return (bool) $value;
    }
}
