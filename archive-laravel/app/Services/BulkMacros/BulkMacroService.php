<?php

namespace App\Services\BulkMacros;

use App\Events\RecordChanged;
use App\Http\Controllers\Api\V1\TrashController;
use App\Models\BulkMacro;
use App\Models\BulkMacroRun;
use App\Models\User;
use App\Services\Automation\AutomationRuleRunner;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use stdClass;
use Throwable;

class BulkMacroService
{
    public const STATUSES = ['draft', 'editing', 'review', 'approved', 'published', 'archived'];

    /** @param array<int, array{store: string, id: string}> $targets */
    public function preview(BulkMacro $macro, User $user, array $targets): array
    {
        $targets = $this->normalizeTargets($targets);
        $results = array_map(fn (array $target): array => $this->previewTarget($macro, $target), $targets);
        $expiresAt = now()->addMinutes(15);

        return [
            'previewToken' => $this->sign(['userId' => (string) $user->id, 'macroId' => $macro->id, 'version' => $macro->version, 'targets' => $targets, 'expiresAt' => $expiresAt->getTimestamp()]),
            'expiresAt' => $expiresAt->toIso8601String(),
            'summary' => [
                'targetCount' => count($targets),
                'affectedCount' => count(array_filter($results, fn (array $result): bool => $result['status'] === 'ready')),
                'missingCount' => count(array_filter($results, fn (array $result): bool => $result['status'] === 'missing')),
            ],
            'results' => $results,
        ];
    }

    /** @param array<int, array{store: string, id: string}> $targets */
    public function validateConfirmation(string $token, BulkMacro $macro, User $user, array $targets): ?string
    {
        $claims = $this->claims($token);
        if (! is_array($claims)) return 'invalid_preview';
        if (($claims['userId'] ?? null) !== (string) $user->id || ($claims['macroId'] ?? null) !== $macro->id || ($claims['targets'] ?? null) !== $this->normalizeTargets($targets)) return 'invalid_preview';
        if (! is_int($claims['expiresAt'] ?? null) || $claims['expiresAt'] <= now()->getTimestamp()) return 'expired_preview';
        if (($claims['version'] ?? null) !== $macro->version) return 'stale_preview';

        return null;
    }

    /** @param array<int, array{store: string, id: string}> $targets */
    public function execute(BulkMacro $macro, User $user, array $targets): BulkMacroRun
    {
        $targets = $this->normalizeTargets($targets);
        $results = array_map(function (array $target) use ($macro, $user): array {
            try {
                return $this->processTarget($macro, $target, $user);
            } catch (Throwable) {
                return ['store' => $target['store'], 'id' => $target['id'], 'status' => 'failed', 'reason' => 'target_failed', 'steps' => []];
            }
        }, $targets);
        $completed = count(array_filter($results, fn (array $result): bool => $result['status'] === 'completed'));

        return BulkMacroRun::query()->create([
            'id' => (string) Str::uuid(), 'macro_id' => $macro->id, 'user_id' => $user->id, 'macro_version' => $macro->version,
            'targets' => $targets, 'results' => $results, 'target_count' => count($targets), 'completed_count' => $completed,
            'failed_count' => count($targets) - $completed,
        ]);
    }

    /** @param array<int, array<string, mixed>> $targets @return array<int, array{store: string, id: string}> */
    public function normalizeTargets(array $targets): array
    {
        $normalized = [];
        foreach ($targets as $target) {
            $store = (string) ($target['store'] ?? '');
            $id = (string) ($target['id'] ?? '');
            $key = $store."\0".$id;
            if ($store !== '' && $id !== '' && ! isset($normalized[$key])) $normalized[$key] = ['store' => $store, 'id' => $id];
        }

        return array_values($normalized);
    }

    /** @param array{store: string, id: string} $target */
    private function previewTarget(BulkMacro $macro, array $target): array
    {
        return $this->processTarget($macro, $target);
    }

    /** @param array{store: string, id: string} $target */
    private function processTarget(BulkMacro $macro, array $target, ?User $user = null): array
    {
        $row = $this->findRow($target);
        if (! $row instanceof stdClass) return ['store' => $target['store'], 'id' => $target['id'], 'status' => 'missing', 'steps' => []];

        $executing = $user instanceof User;
        $record = $this->decode($row->data);
        $steps = [];
        $deleted = false;
        foreach ($macro->steps as $index => $step) {
            if ($deleted) {
                $steps[] = ['index' => $index, 'type' => $step['type'], 'status' => 'skipped', 'reason' => 'deleted'];
                continue;
            }
            $outcome = $this->simulate($record, $step, $index);
            if (! $executing) {
                $steps[] = $outcome;
                if ($step['type'] === 'delete') $deleted = true;
                continue;
            }

            $recordBeforeStep = $record;
            try {
                if ($step['type'] === 'delete') {
                    DB::transaction(function () use ($row, $user): void {
                        TrashController::trashRow($row, $user);
                        $affected = DB::table('storage_rows')->where('store', $row->store)->where('uid', $row->uid)->delete();
                        if ($affected !== 1) throw new RuntimeException('Bulk macro delete did not affect exactly one row.');
                    });
                    $deleted = true;
                } else {
                    DB::transaction(function () use ($row, $record): void {
                        $affected = DB::table('storage_rows')->where('store', $row->store)->where('uid', $row->uid)->update([
                            'data' => json_encode($record, JSON_THROW_ON_ERROR),
                            'updated_at' => now(),
                        ]);
                        if ($affected !== 1) throw new RuntimeException('Bulk macro mutation did not affect exactly one row.');
                        if ($row->store === AutomationRuleRunner::ARCHIVE_STORE) {
                            RecordChanged::dispatch((string) $row->store, (string) $row->uid, $record, false);
                        }
                    });
                }
                $outcome['status'] = 'completed';
                $steps[] = $outcome;
            } catch (Throwable) {
                $record = $recordBeforeStep;
                $steps[] = ['index' => $index, 'type' => $step['type'], 'status' => 'failed', 'reason' => 'mutation_failed'];
            }
        }

        $status = $executing
            ? (in_array('failed', array_column($steps, 'status'), true) ? 'partial' : 'completed')
            : 'ready';

        return ['store' => $target['store'], 'id' => $target['id'], 'status' => $status, 'steps' => $steps];
    }

    /** @param array<string, mixed> $record @param array<string, mixed> $step @return array<string, mixed> */
    private function simulate(array &$record, array $step, int $index): array
    {
        if ($step['type'] === 'add-tag') {
            $before = array_values(array_filter((array) ($record['tags'] ?? []), 'is_string'));
            $record['tags'] = array_values(array_unique([...$before, $step['tag']]));
            return ['index' => $index, 'type' => 'add-tag', 'status' => 'would_apply', 'before' => $before, 'after' => $record['tags']];
        }
        if ($step['type'] === 'set-workflow-status') {
            $before = $record['workflowStatus'] ?? null;
            $record['workflowStatus'] = $step['status'];
            return ['index' => $index, 'type' => 'set-workflow-status', 'status' => 'would_apply', 'before' => $before, 'after' => $step['status']];
        }

        return ['index' => $index, 'type' => 'delete', 'status' => 'would_apply', 'reversible' => true];
    }

    /** @param array{store: string, id: string} $target */
    private function findRow(array $target): ?stdClass
    {
        $row = DB::table('storage_rows')->where('store', $target['store'])->where(function ($query) use ($target): void {
            $query->where('uid', $target['id'])->orWhereRaw("data->>'id' = ?", [$target['id']]);
        })->first();
        return $row instanceof stdClass ? $row : null;
    }

    /** @return array<string, mixed> */
    private function decode(string $json): array
    {
        $data = json_decode($json, true);
        return is_array($data) ? $data : [];
    }

    /** @param array<string, mixed> $claims */
    private function sign(array $claims): string
    {
        $payload = rtrim(strtr(base64_encode(json_encode($claims, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        return $payload.'.'.hash_hmac('sha256', $payload, (string) config('app.key'));
    }

    /** @return array<string, mixed>|null */
    private function claims(string $token): ?array
    {
        [$payload, $signature] = array_pad(explode('.', $token, 2), 2, null);
        if (! is_string($payload) || ! is_string($signature) || ! hash_equals(hash_hmac('sha256', $payload, (string) config('app.key')), $signature)) return null;
        $decoded = base64_decode(strtr($payload, '-_', '+/').str_repeat('=', (4 - strlen($payload) % 4) % 4), true);
        $claims = is_string($decoded) ? json_decode($decoded, true) : null;
        return is_array($claims) ? $claims : null;
    }
}
