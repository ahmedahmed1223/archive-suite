<?php

declare(strict_types=1);

namespace App\Ai;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\RateLimiter;

/**
 * AI-805: applies an installation-owned budget before any archive content is
 * sent to a hosted model. Actual provider billing can differ, therefore the
 * audit trail deliberately calls the figures "estimated" rather than making
 * a false claim of invoice-level precision.
 */
final class AiUsageGovernor
{
    public function reserve(User $user, ?string $departmentId, string $message): void
    {
        $limits = $this->limits();
        $userKey = 'ai-assistant:user:'.$user->getKey();
        if (RateLimiter::tooManyAttempts($userKey, $limits['user_requests_per_hour'])) {
            throw new AiUsageLimitExceeded('AI assistant request limit reached for this user.');
        }

        if ($departmentId !== null) {
            $departmentKey = 'ai-assistant:department:'.$departmentId;
            if (RateLimiter::tooManyAttempts($departmentKey, $limits['department_requests_per_day'])) {
                throw new AiUsageLimitExceeded('AI assistant request limit reached for this department.');
            }
        }

        $reservedCents = $this->estimateCents($message, $limits['max_output_tokens']);
        if ($this->estimatedCentsForUser($user) + $reservedCents > $limits['user_daily_cents']) {
            throw new AiUsageLimitExceeded('AI assistant daily cost limit reached for this user.');
        }

        if ($departmentId !== null && $this->estimatedCentsForDepartment($departmentId) + $reservedCents > $limits['department_daily_cents']) {
            throw new AiUsageLimitExceeded('AI assistant daily cost limit reached for this department.');
        }

        RateLimiter::hit($userKey, 3600);
        if ($departmentId !== null) {
            RateLimiter::hit('ai-assistant:department:'.$departmentId, 86400);
        }
    }

    /** @param array<string, mixed> $result */
    public function recordCompleted(User $user, ?string $departmentId, string $message, array $result): void
    {
        $answer = (string) ($result['answer'] ?? '');
        $inputTokens = $this->estimateTokens($message);
        $outputTokens = $this->estimateTokens($answer);

        AuditLog::query()->create([
            'action' => 'AI assistant request',
            'event' => 'ai.assistant.completed',
            'resource_type' => 'ai_assistant',
            'actor_id' => $user->getKey(),
            'outcome' => 'success',
            'status_code' => 200,
            'metadata' => [
                'departmentId' => $departmentId,
                'estimatedInputTokens' => $inputTokens,
                'estimatedOutputTokens' => $outputTokens,
                'estimatedCents' => $this->estimateCents($message, $outputTokens),
                'providerChain' => array_keys((array) config('ai.governance.failover')),
            ],
        ]);
    }

    /** @return array{user_requests_per_hour:int,department_requests_per_day:int,user_daily_cents:int,department_daily_cents:int,max_output_tokens:int,input_cents_per_1k:int,output_cents_per_1k:int} */
    private function limits(): array
    {
        return array_map(fn (mixed $value): int => max(1, (int) $value), config('ai.governance.limits'));
    }

    private function estimatedCentsForUser(User $user): int
    {
        return $this->today()->where('actor_id', $user->getKey())->get()->sum(fn (AuditLog $log): int => (int) data_get($log->metadata, 'estimatedCents', 0));
    }

    private function estimatedCentsForDepartment(string $departmentId): int
    {
        return $this->today()->get()->sum(fn (AuditLog $log): int => data_get($log->metadata, 'departmentId') === $departmentId ? (int) data_get($log->metadata, 'estimatedCents', 0) : 0);
    }

    private function today(): Builder
    {
        return AuditLog::query()->where('event', 'ai.assistant.completed')->where('created_at', '>=', now()->startOfDay());
    }

    private function estimateTokens(string $text): int
    {
        return max(1, (int) ceil(mb_strlen($text) / 4));
    }

    private function estimateCents(string $message, int $outputTokens): int
    {
        $limits = $this->limits();

        return (int) ceil(($this->estimateTokens($message) * $limits['input_cents_per_1k'] + $outputTokens * $limits['output_cents_per_1k']) / 1000);
    }
}
