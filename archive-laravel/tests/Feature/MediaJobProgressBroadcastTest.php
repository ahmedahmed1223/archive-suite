<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Events\MediaJobProgressUpdated;
use App\Models\MediaJob;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * RT-801: MediaJobProgressUpdated dispatch on a real status transition, and
 * the admin-or-creator visibility rule (MediaJob::isAccessibleBy(), also
 * used by the media-job.{jobId} channel gate in routes/channels.php and by
 * MediaJobsController::canAccess()) — tested directly rather than through
 * the raw /api/v1/broadcasting/auth HTTP endpoint, matching how this
 * codebase already tests broadcast events elsewhere (ReviewCommentsApiTest,
 * CollaborationPresenceApiTest): Event::fake() + assertDispatched on the
 * channel name, not a live broadcaster round-trip.
 */
class MediaJobProgressBroadcastTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancel_dispatches_media_job_progress_updated(): void
    {
        Event::fake([MediaJobProgressUpdated::class]);

        [$token, $userId] = $this->login('owner@example.test', 'editor');
        $job = $this->createJob('job-cancel-1', $userId);

        $this->postJson("/api/v1/media/jobs/{$job->id}/cancel", [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('job.status', 'canceled');

        Event::assertDispatched(MediaJobProgressUpdated::class, function (MediaJobProgressUpdated $event) use ($job): bool {
            return $event->jobId === $job->id
                && $event->job['status'] === 'canceled'
                && in_array('private-media-job.'.$job->id, array_map(
                    fn ($channel) => $channel->name,
                    $event->broadcastOn()
                ), true);
        });
    }

    public function test_job_is_accessible_by_its_creator(): void
    {
        $creator = $this->makeUser('creator@example.test', 'viewer');
        $job = $this->createJob('job-access-creator', (string) $creator->id);

        $this->assertTrue($job->isAccessibleBy($creator));
    }

    public function test_job_is_accessible_by_an_admin(): void
    {
        $owner = $this->makeUser('owner4@example.test', 'viewer');
        $admin = $this->makeUser('admin4@example.test', 'admin');
        $job = $this->createJob('job-access-admin', (string) $owner->id);

        $this->assertTrue($job->isAccessibleBy($admin));
    }

    public function test_job_is_not_accessible_by_an_unrelated_user(): void
    {
        $owner = $this->makeUser('owner5@example.test', 'viewer');
        $stranger = $this->makeUser('stranger5@example.test', 'viewer');
        $job = $this->createJob('job-access-stranger', (string) $owner->id);

        $this->assertFalse($job->isAccessibleBy($stranger));
    }

    private function createJob(string $id, string $createdBy): MediaJob
    {
        return MediaJob::query()->create([
            'id' => $id,
            'record_id' => 'media-record-'.$id,
            'created_by' => $createdBy,
            'operation' => 'transcription',
            'status' => 'queued',
            'options' => [],
            'queued_at' => now(),
        ]);
    }

    private function makeUser(string $email, string $role): User
    {
        return User::query()->create([
            'name' => 'Test User',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }

    /**
     * @return array{0: string, 1: string} [accessToken, userId]
     */
    private function login(string $email, string $role): array
    {
        $user = $this->makeUser($email, $role);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password',
        ])->assertOk();

        $token = $response->json('accessToken');
        $this->assertIsString($token);

        return [$token, (string) $user->id];
    }
}
