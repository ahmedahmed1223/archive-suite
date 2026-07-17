<?php

namespace Tests\Feature\Api\V1;

use App\Jobs\DeliverWebhook;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;
use Throwable;

/**
 * V1-759: admin-managed webhook subscriptions and the DeliverWebhook
 * delivery job (signing, retry policy, auto-disable).
 */
class WebhooksTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->json('accessToken');
    }

    private function adminHeaders(): array
    {
        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@example.test'],
            ['name' => 'Admin', 'password' => Hash::make('secret-password'), 'role' => 'admin'],
        );

        return ['Authorization' => 'Bearer '.$this->tokenFor($admin)];
    }

    private function editorHeaders(): array
    {
        $editor = User::query()->firstOrCreate(
            ['email' => 'editor@example.test'],
            ['name' => 'Editor', 'password' => Hash::make('secret-password'), 'role' => 'editor'],
        );

        return ['Authorization' => 'Bearer '.$this->tokenFor($editor)];
    }

    public function test_admin_can_create_a_webhook_and_the_raw_secret_is_shown_once(): void
    {
        $response = $this->postJson('/api/v1/webhooks', [
            'name' => 'Record sync',
            'url' => 'http://93.184.216.34/hooks/archive',
            'events' => ['record.created', 'record.updated'],
        ], $this->adminHeaders())
            ->assertCreated()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('webhook.url', 'http://93.184.216.34/hooks/archive')
            ->assertJsonPath('webhook.active', true);

        $secret = $response->json('secret');
        $this->assertIsString($secret);
        $this->assertNotSame('', $secret);

        $this->assertDatabaseMissing('webhook_subscriptions', ['secret_hash' => $secret]);
        $this->assertDatabaseHas('webhook_subscriptions', [
            'url' => 'http://93.184.216.34/hooks/archive',
            'secret_hash' => hash('sha256', $secret),
        ]);
    }

    public function test_webhook_rejects_unknown_event_names(): void
    {
        $this->postJson('/api/v1/webhooks', [
            'url' => 'http://93.184.216.34/hooks/archive',
            'events' => ['not.a.real.event'],
        ], $this->adminHeaders())->assertUnprocessable();
    }

    public function test_webhook_rejects_a_loopback_url(): void
    {
        $this->postJson('/api/v1/webhooks', [
            'url' => 'http://127.0.0.1:8080/hook',
            'events' => ['record.created'],
        ], $this->adminHeaders())
            ->assertUnprocessable()
            ->assertJsonPath('ok', false);

        $this->assertDatabaseMissing('webhook_subscriptions', ['url' => 'http://127.0.0.1:8080/hook']);
    }

    public function test_webhook_rejects_a_private_range_url(): void
    {
        $this->postJson('/api/v1/webhooks', [
            'url' => 'http://10.0.5.9/hook',
            'events' => ['record.created'],
        ], $this->adminHeaders())->assertUnprocessable();
    }

    public function test_non_admin_cannot_manage_webhooks(): void
    {
        $this->getJson('/api/v1/webhooks', $this->editorHeaders())->assertForbidden();
    }

    public function test_admin_can_list_and_delete_webhooks(): void
    {
        $headers = $this->adminHeaders();

        $id = $this->postJson('/api/v1/webhooks', [
            'url' => 'http://93.184.216.34/hooks/archive',
            'events' => ['record.deleted'],
        ], $headers)->assertCreated()->json('webhook.id');

        $this->getJson('/api/v1/webhooks', $headers)
            ->assertOk()
            ->assertJsonCount(1, 'webhooks');

        $this->deleteJson("/api/v1/webhooks/{$id}", [], $headers)
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseMissing('webhook_subscriptions', ['id' => $id]);
    }

    public function test_deleting_an_unknown_webhook_404s(): void
    {
        $this->deleteJson('/api/v1/webhooks/does-not-exist', [], $this->adminHeaders())
            ->assertNotFound();
    }

    public function test_deliver_webhook_signs_the_body_and_records_success(): void
    {
        Http::fake(['93.184.216.34/*' => Http::response(['received' => true], 200)]);

        [$id, $secret] = $this->createSubscription();

        (new DeliverWebhook($id, 'record.created', ['id' => 'rec-1']))->handle();

        Http::assertSent(function ($request) use ($secret) {
            $expectedSignature = hash_hmac('sha256', $request->body(), hash('sha256', $secret));

            return $request->hasHeader('X-Archive-Signature', $expectedSignature)
                && $request->url() === 'http://93.184.216.34/hooks/archive';
        });

        $row = DB::table('webhook_subscriptions')->where('id', $id)->first();
        $this->assertSame(0, (int) $row->consecutive_failures);
        $this->assertNotNull($row->last_delivered_at);
    }

    public function test_deliver_webhook_throws_on_a_non_successful_response_for_the_queue_to_retry(): void
    {
        Http::fake(['93.184.216.34/*' => Http::response('nope', 500)]);

        [$id] = $this->createSubscription();

        $this->expectException(Throwable::class);

        (new DeliverWebhook($id, 'record.created', ['id' => 'rec-1']))->handle();
    }

    public function test_subscription_auto_disables_after_20_consecutive_failures(): void
    {
        [$id] = $this->createSubscription();

        DB::table('webhook_subscriptions')->where('id', $id)->update(['consecutive_failures' => 19]);

        (new DeliverWebhook($id, 'record.created', ['id' => 'rec-1']))->failed(new \RuntimeException('boom'));

        $row = DB::table('webhook_subscriptions')->where('id', $id)->first();
        $this->assertSame(20, (int) $row->consecutive_failures);
        $this->assertFalse((bool) $row->active);
    }

    public function test_subscription_stays_active_before_reaching_20_failures(): void
    {
        [$id] = $this->createSubscription();

        (new DeliverWebhook($id, 'record.created', ['id' => 'rec-1']))->failed(new \RuntimeException('boom'));

        $row = DB::table('webhook_subscriptions')->where('id', $id)->first();
        $this->assertSame(1, (int) $row->consecutive_failures);
        $this->assertTrue((bool) $row->active);
    }

    public function test_deliver_webhook_re_checks_ssrf_at_delivery_time_and_counts_it_as_a_failure(): void
    {
        $id = (string) Str::uuid();
        $secret = Str::random(48);

        // Simulates a subscription whose URL now resolves to a private
        // range (e.g. DNS rebinding after subscribe-time validation).
        DB::table('webhook_subscriptions')->insert([
            'id' => $id,
            'name' => null,
            'url' => 'http://127.0.0.1/hook',
            'events' => json_encode(['record.created']),
            'secret_hash' => hash('sha256', $secret),
            'active' => true,
            'consecutive_failures' => 0,
            'last_delivered_at' => null,
            'created_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        (new DeliverWebhook($id, 'record.created', ['id' => 'rec-1']))->handle();

        $row = DB::table('webhook_subscriptions')->where('id', $id)->first();
        $this->assertSame(1, (int) $row->consecutive_failures);
        $this->assertTrue((bool) $row->active);
    }

    /**
     * @return array{0: string, 1: string} [subscriptionId, rawSecret]
     */
    private function createSubscription(): array
    {
        $response = $this->postJson('/api/v1/webhooks', [
            'url' => 'http://93.184.216.34/hooks/archive',
            'events' => ['record.created'],
        ], $this->adminHeaders())->assertCreated();

        return [$response->json('webhook.id'), $response->json('secret')];
    }
}
