<?php

namespace App\Jobs;

use App\Support\SsrfGuard;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * V1-759: one HTTP delivery attempt (with Laravel's own retry/backoff) for a
 * webhook subscription. `data` must already be the minimal, documented event
 * fields — this job does not decide what to send, only how to sign and
 * deliver it, so no PII/full-row filtering happens here.
 */
class DeliverWebhook implements ShouldQueue
{
    use Queueable;

    /** Initial attempt + 3 retries, per the retry policy in the card. */
    public int $tries = 4;

    /**
     * @param array<string, mixed> $data
     */
    public function __construct(
        public readonly string $subscriptionId,
        public readonly string $event,
        public readonly array $data,
    ) {}

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        $subscription = DB::table('webhook_subscriptions')->where('id', $this->subscriptionId)->first();

        if (! $subscription || ! $subscription->active) {
            return;
        }

        // Re-check on every delivery, not just at subscribe time — cheap
        // insurance against a URL that resolved as public then, private now.
        if (! SsrfGuard::isPublicHttpUrl($subscription->url)) {
            Log::error('Webhook URL failed SSRF check at delivery time, disabling subscription', [
                'subscriptionId' => $this->subscriptionId,
            ]);
            $this->disable();
            $this->fail(new \RuntimeException('Webhook URL is no longer a valid public address.'));

            return;
        }

        $body = json_encode([
            'event' => $this->event,
            'data' => $this->data,
            'deliveredAt' => now()->toIso8601String(),
        ], JSON_THROW_ON_ERROR);

        $signature = hash_hmac('sha256', $body, $subscription->secret_hash);

        $response = Http::withBody($body, 'application/json')
            ->withHeaders(['X-Archive-Signature' => $signature])
            ->timeout(10)
            ->post($subscription->url);

        if (! $response->successful()) {
            throw new \RuntimeException("Webhook delivery failed: HTTP {$response->status()}");
        }

        DB::table('webhook_subscriptions')->where('id', $this->subscriptionId)->update([
            'last_delivered_at' => now(),
            'consecutive_failures' => 0,
            'updated_at' => now(),
        ]);
    }

    /**
     * Called once after all retry attempts are exhausted (or immediately for
     * a non-retryable failure raised via $this->fail() above).
     */
    public function failed(Throwable $exception): void
    {
        Log::warning('Webhook delivery exhausted retries', [
            'subscriptionId' => $this->subscriptionId,
            'event' => $this->event,
            'error' => $exception->getMessage(),
        ]);

        $this->disable();
    }

    /**
     * Increments the subscription's consecutive-failure counter and
     * auto-disables it once that counter reaches 20, per the card's retry
     * policy. A successful delivery (handle() above) resets it to 0.
     */
    private function disable(): void
    {
        $subscription = DB::table('webhook_subscriptions')->where('id', $this->subscriptionId)->first();

        if (! $subscription) {
            return;
        }

        $failures = (int) $subscription->consecutive_failures + 1;

        DB::table('webhook_subscriptions')->where('id', $this->subscriptionId)->update([
            'consecutive_failures' => $failures,
            'active' => $failures >= 20 ? false : (bool) $subscription->active,
            'updated_at' => now(),
        ]);
    }
}
