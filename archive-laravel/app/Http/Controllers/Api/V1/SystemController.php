<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSecuritySettingsRequest;
use App\Services\Odbc\OdbcConnectionFactory;
use App\Services\Odbc\OdbcConnectionProbe;
use App\Services\Odbc\OdbcReadRepository;
use App\Services\Security\SecuritySettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemController extends Controller
{
    public function odbc(OdbcConnectionProbe $probe): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'odbc' => $probe->probe(),
        ]);
    }

    public function odbcReadTable(
        Request $request,
        string $table,
        OdbcConnectionFactory $factory,
    ): JsonResponse {
        $repository = new OdbcReadRepository(
            $factory->connect(
                config('odbc.dsn', ''),
                config('odbc.username'),
                config('odbc.password'),
            ),
            config('odbc', []),
        );

        // Check allowlist
        if (! in_array($table, $repository->getAllowedCoreTables(), true)) {
            return response()->json([
                'ok' => false,
                'error' => 'Table access denied.',
            ], 403);
        }

        $limit = (int) $request->query('limit', config('odbc.table_limit', 25));
        $rows = $repository->readRows($table, $limit);

        return response()->json([
            'ok' => true,
            'table' => $table,
            'count' => count($rows),
            'rows' => $rows,
        ]);
    }

    public function odbcCreateRow(
        Request $request,
        string $table,
        OdbcConnectionFactory $factory,
    ): JsonResponse {
        $validated = $request->validate([
            'values' => ['required', 'array', 'min:1'],
        ]);

        return $this->odbcWriteResponse(
            $table,
            'insert',
            fn (OdbcReadRepository $repository): array => $repository->insertRow($table, $validated['values']),
            $factory,
            201,
        );
    }

    public function odbcUpdateRow(
        Request $request,
        string $table,
        OdbcConnectionFactory $factory,
    ): JsonResponse {
        $validated = $request->validate([
            'keyColumn' => ['required', 'string'],
            'keyValue' => ['required'],
            'values' => ['required', 'array', 'min:1'],
        ]);

        return $this->odbcWriteResponse(
            $table,
            'update',
            fn (OdbcReadRepository $repository): array => $repository->updateRow(
                $table,
                $validated['keyColumn'],
                $validated['keyValue'],
                $validated['values'],
            ),
            $factory,
        );
    }

    public function odbcDeleteRow(
        Request $request,
        string $table,
        OdbcConnectionFactory $factory,
    ): JsonResponse {
        $validated = $request->validate([
            'keyColumn' => ['required', 'string'],
            'keyValue' => ['required'],
        ]);

        return $this->odbcWriteResponse(
            $table,
            'delete',
            fn (OdbcReadRepository $repository): array => $repository->deleteRow(
                $table,
                $validated['keyColumn'],
                $validated['keyValue'],
            ),
            $factory,
        );
    }

    public function getSecuritySettings(Request $request, SecuritySettingsService $service): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return response()->json([
            'ok' => true,
            'settings' => $service->getSettings(),
        ]);
    }

    public function updateSecuritySettings(
        UpdateSecuritySettingsRequest $request,
        SecuritySettingsService $service,
    ): JsonResponse {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        try {
            $validated = $request->validated();

            if (isset($validated['accessTokenTtlMinutes'])) {
                $service->updateAccessTokenTtl($validated['accessTokenTtlMinutes']);
            }

            if (isset($validated['perUserRateLimit'])) {
                $service->updatePerUserRateLimit($validated['perUserRateLimit']);
            }

            if (isset($validated['webhookUrlAllowlist'])) {
                $service->updateWebhookUrlAllowlist($validated['webhookUrlAllowlist']);
            }

            if (isset($validated['legacyPasswordUpgrade'])) {
                $service->updateLegacyPasswordUpgrade($validated['legacyPasswordUpgrade']);
            }

            return response()->json([
                'ok' => true,
                'settings' => $service->getSettings(),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'ok' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * @param  callable(OdbcReadRepository): array{affected: int}  $operation
     */
    public function testStorageConnection(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        // Missing/empty payload means "test the app's default local disk".
        $validated = $request->validate([
            'driver' => ['sometimes', 'string', 'in:local,s3'],
            'name' => ['sometimes', 'string', 'max:255'],
            'config' => ['sometimes', 'array'],
        ]);

        try {
            $result = $this->probeStorageConnection(
                $validated['driver'] ?? 'local',
                $validated['name'] ?? 'default',
                $validated['config'] ?? []
            );

            return response()->json([
                'ok' => true,
                'connection' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'error' => 'Connection test failed.',
                'details' => $e->getMessage(),
            ], 422);
        }
    }

    public function testDatabaseConnection(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'driver' => ['required', 'string', 'in:mysql,pgsql,sqlite'],
            'host' => ['nullable', 'string'],
            'port' => ['nullable', 'integer'],
            'database' => ['required', 'string'],
            'username' => ['nullable', 'string'],
            'password' => ['nullable', 'string'],
        ]);

        try {
            $result = $this->probeDatabaseConnection($validated);

            return response()->json([
                'ok' => true,
                'connection' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'error' => 'Database connection test failed.',
                'details' => $e->getMessage(),
            ], 422);
        }
    }

    private function probeStorageConnection(string $driver, string $name, array $config): array
    {
        $testKey = 'archive-test-' . uniqid() . '.txt';
        $testContent = 'Archive connection test at ' . now()->toIso8601String();

        if ($driver === 'local') {
            $path = $config['root'] ?? config('filesystems.disks.local.root');
            if (!is_dir($path)) {
                throw new \RuntimeException('Local storage path does not exist: ' . $path);
            }

            $testFile = $path . '/' . $testKey;
            file_put_contents($testFile, $testContent);
            $read = file_get_contents($testFile);
            @unlink($testFile);

            if ($read !== $testContent) {
                throw new \RuntimeException('Write/read mismatch for local storage');
            }

            return [
                'status' => 'connected',
                'driver' => 'local',
                'message' => 'Local storage is accessible and writable.',
                'testedAt' => now()->toIso8601String(),
            ];
        }

        if ($driver === 's3') {
            try {
                $s3Client = \Aws\S3\S3Client::factory([
                    'key' => $config['key'] ?? '',
                    'secret' => $config['secret'] ?? '',
                    'region' => $config['region'] ?? 'us-east-1',
                    'endpoint' => $config['endpoint'] ?? null,
                    'use_path_style_endpoint' => $config['use_path_style_endpoint'] ?? false,
                ]);

                $bucket = $config['bucket'] ?? '';
                if (!$bucket) {
                    throw new \RuntimeException('S3 bucket name not configured');
                }

                $s3Client->putObject([
                    'Bucket' => $bucket,
                    'Key' => $testKey,
                    'Body' => $testContent,
                ]);

                $object = $s3Client->getObject([
                    'Bucket' => $bucket,
                    'Key' => $testKey,
                ]);

                $read = (string) $object['Body'];

                $s3Client->deleteObject([
                    'Bucket' => $bucket,
                    'Key' => $testKey,
                ]);

                if ($read !== $testContent) {
                    throw new \RuntimeException('Write/read mismatch for S3 storage');
                }

                return [
                    'status' => 'connected',
                    'driver' => 's3',
                    'message' => 'S3 bucket is accessible and writable.',
                    'bucket' => $bucket,
                    'region' => $config['region'] ?? 'us-east-1',
                    'testedAt' => now()->toIso8601String(),
                ];
            } catch (\Throwable $e) {
                throw new \RuntimeException('S3 connection failed: ' . $e->getMessage());
            }
        }

        throw new \RuntimeException('Unsupported storage driver: ' . $driver);
    }

    private function probeDatabaseConnection(array $params): array
    {
        $driver = $params['driver'];
        $host = $params['host'] ?? 'localhost';
        $port = $params['port'] ?? null;
        $database = $params['database'];
        $username = $params['username'] ?? '';
        $password = $params['password'] ?? '';

        try {
            if ($driver === 'mysql') {
                if (!$port) {
                    $port = 3306;
                }
                $pdo = new \PDO(
                    "mysql:host={$host};port={$port};dbname={$database}",
                    $username,
                    $password,
                    [\PDO::ATTR_TIMEOUT => 5]
                );
            } elseif ($driver === 'pgsql') {
                if (!$port) {
                    $port = 5432;
                }
                $pdo = new \PDO(
                    "pgsql:host={$host};port={$port};dbname={$database}",
                    $username,
                    $password,
                    [\PDO::ATTR_TIMEOUT => 5]
                );
            } elseif ($driver === 'sqlite') {
                $pdo = new \PDO("sqlite:{$database}");
            } else {
                throw new \RuntimeException('Unsupported database driver: ' . $driver);
            }

            $result = $pdo->query('SELECT 1');
            if (!$result) {
                throw new \RuntimeException('Query execution failed');
            }

            return [
                'status' => 'connected',
                'driver' => $driver,
                'database' => $database,
                'message' => 'Database connection is successful.',
                'testedAt' => now()->toIso8601String(),
            ];
        } catch (\PDOException $e) {
            throw new \RuntimeException('Database connection error: ' . $e->getMessage());
        }
    }

    private function odbcWriteResponse(
        string $table,
        string $operationName,
        callable $operation,
        OdbcConnectionFactory $factory,
        int $status = 200,
    ): JsonResponse {
        $repository = new OdbcReadRepository(
            $factory->connect(
                config('odbc.dsn', ''),
                config('odbc.username'),
                config('odbc.password'),
            ),
            config('odbc', []),
        );

        if (! in_array($table, $repository->getAllowedCoreTables(), true)) {
            return response()->json([
                'ok' => false,
                'error' => 'Table access denied.',
            ], 403);
        }

        try {
            $result = $operation($repository);

            return response()->json([
                'ok' => true,
                'table' => $table,
                'operation' => $operationName,
                'affected' => $result['affected'],
            ], $status);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'ok' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }
}
