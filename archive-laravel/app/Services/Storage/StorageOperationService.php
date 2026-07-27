<?php

declare(strict_types=1);

namespace App\Services\Storage;

use App\Models\StorageOperation;
use App\Models\StorageOperationItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/** Durable state machine for observable, idempotent storage operations. */
final class StorageOperationService
{
    private const ACTIONS = ['copy', 'move', 'delete', 'rename', 'create_folder', 'restore', 'upload'];

    /**
     * Generates a signed, short-lived preview. Confirmation is impossible
     * without this exact token, which prevents a destructive UI preview from
     * being changed between display and execution.
     *
     * @param list<array{sourcePath?:string,destinationPath?:string,expectedChecksum?:string,metadata?:array<string,mixed>}> $items
     * @return array{previewToken:string,expiresAt:string,action:string,items:list<array<string,mixed>>}
     */
    public function preview(string $action, string $sourceProviderId, ?string $destinationProviderId, array $items): array
    {
        $this->assertAction($action);
        if ($items === []) {
            throw new RuntimeException('At least one operation item is required.');
        }

        $payload = [
            'v' => 1,
            'nonce' => (string) Str::uuid(),
            'action' => $action,
            'sourceProviderId' => $sourceProviderId,
            'destinationProviderId' => $destinationProviderId,
            'items' => $items,
            'exp' => now()->addMinutes(10)->getTimestamp(),
        ];
        $token = $this->sign($payload);

        return [
            'previewToken' => $token,
            'expiresAt' => now()->addMinutes(10)->toIso8601String(),
            'action' => $action,
            'items' => $items,
        ];
    }

    /** @return StorageOperation */
    public function start(string $previewToken, string $idempotencyKey, ?int $requestedBy = null): StorageOperation
    {
        $payload = $this->verify($previewToken);

        return DB::transaction(function () use ($payload, $previewToken, $idempotencyKey, $requestedBy): StorageOperation {
            $existing = StorageOperation::query()->where('idempotency_key', $idempotencyKey)->first();
            if ($existing instanceof StorageOperation) {
                return $existing->load('items');
            }

            $operation = StorageOperation::query()->create([
                'idempotency_key' => $idempotencyKey,
                'action' => $payload['action'],
                'status' => 'queued',
                'requested_by' => $requestedBy,
                'source_provider_id' => $payload['sourceProviderId'],
                'destination_provider_id' => $payload['destinationProviderId'],
                'preview_token_hash' => hash('sha256', $previewToken),
                'preview_expires_at' => now()->setTimestamp((int) $payload['exp']),
                'resume_state' => ['nextItem' => 0],
                'metadata' => ['previewNonce' => $payload['nonce']],
            ]);

            foreach ($payload['items'] as $item) {
                $operation->items()->create([
                    'source_path' => $item['sourcePath'] ?? null,
                    'destination_path' => $item['destinationPath'] ?? null,
                    'expected_checksum' => $item['expectedChecksum'] ?? null,
                    'status' => 'pending',
                    'metadata' => $item['metadata'] ?? [],
                ]);
            }

            return $operation->load('items');
        });
    }

    public function cancel(StorageOperation $operation): StorageOperation
    {
        if (in_array($operation->status, ['completed', 'failed', 'cancelled'], true)) {
            return $operation;
        }

        $operation->forceFill(['status' => 'cancelled', 'cancelled_at' => now()])->save();
        $operation->items()->whereIn('status', ['pending', 'running'])->update(['status' => 'cancelled']);

        return $operation->fresh(['items']);
    }

    public function checkpoint(StorageOperation $operation, int $nextItem, int $offset = 0): StorageOperation
    {
        if ($operation->status === 'cancelled') {
            return $operation;
        }

        $operation->forceFill([
            'status' => 'paused',
            'resume_state' => ['nextItem' => $nextItem, 'offset' => $offset],
        ])->save();

        return $operation->fresh(['items']);
    }

    public function recordChecksum(StorageOperationItem $item, string $actualChecksum): StorageOperationItem
    {
        $expected = $item->expected_checksum;
        $matches = $expected === null || hash_equals(strtolower($expected), strtolower($actualChecksum));
        $item->forceFill([
            'checksum' => $actualChecksum,
            'status' => $matches ? 'completed' : 'conflict',
            'error_code' => $matches ? null : 'CHECKSUM_CONFLICT',
            'error_message' => $matches ? null : 'Source and destination checksums differ.',
        ])->save();

        return $item->fresh();
    }

    /** @param array<string,mixed> $payload */
    private function sign(array $payload): string
    {
        $encoded = rtrim(strtr(base64_encode((string) json_encode($payload, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $encoded, (string) config('app.key'), true);
        return $encoded.'.'.rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    }

    /** @return array{action:string,sourceProviderId:string,destinationProviderId:?string,items:list<array<string,mixed>>,exp:int,nonce:string,v:int} */
    private function verify(string $token): array
    {
        [$encoded, $signature] = array_pad(explode('.', $token, 2), 2, null);
        if (! is_string($encoded) || ! is_string($signature)) {
            throw new RuntimeException('Invalid preview token.');
        }
        $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $encoded, (string) config('app.key'), true)), '+/', '-_'), '=');
        if (! hash_equals($expected, $signature)) {
            throw new RuntimeException('Invalid preview token.');
        }
        $decoded = json_decode((string) base64_decode(strtr($encoded, '-_', '+/'), true), true);
        if (! is_array($decoded) || ! isset($decoded['exp'], $decoded['action'], $decoded['items']) || (int) $decoded['exp'] < now()->getTimestamp()) {
            throw new RuntimeException('Expired preview token.');
        }
        $this->assertAction((string) $decoded['action']);
        return $decoded;
    }

    private function assertAction(string $action): void
    {
        if (! in_array($action, self::ACTIONS, true)) {
            throw new RuntimeException('Unsupported storage operation.');
        }
    }
}
