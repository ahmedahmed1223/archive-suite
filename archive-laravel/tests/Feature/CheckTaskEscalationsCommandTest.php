<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * V3-WORK-002: covers the three acceptance criteria that are hardest to get
 * right for a scheduled sweep - idempotency (run twice, one notification),
 * the mandatory/optional notification boundary (overdue escalation always
 * reaches the assignee; the due-soon notice only reaches an assignee who
 * opted in), and timezone-independence (the sweep compares UTC epoch
 * seconds, so it must produce the same result no matter what PHP's runtime
 * default timezone is set to).
 */
class CheckTaskEscalationsCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_overdue_task_sends_a_mandatory_escalation_even_when_the_assignee_opted_out_of_everything(): void
    {
        $assignee = $this->makeAssignee();
        $this->setNotificationPreferences($assignee, optional: []);
        $taskId = $this->createTask($assignee->email, targetDeadlineAt: now()->subMinutes(10));

        Artisan::call('tasks:check-escalations');

        $this->assertSame(1, Notification::where('user_id', $assignee->id)->where('type', 'task_escalation')->count());
        $this->assertNotNull(DB::table('project_tasks')->where('id', $taskId)->value('escalated_at'));
    }

    public function test_running_the_sweep_twice_in_the_same_window_does_not_duplicate_the_escalation(): void
    {
        $assignee = $this->makeAssignee();
        $this->createTask($assignee->email, targetDeadlineAt: now()->subMinutes(10));

        Artisan::call('tasks:check-escalations');
        Artisan::call('tasks:check-escalations');

        $this->assertSame(1, Notification::where('user_id', $assignee->id)->where('type', 'task_escalation')->count());
    }

    public function test_running_the_sweep_twice_for_a_due_soon_task_does_not_duplicate_the_notice(): void
    {
        $assignee = $this->makeAssignee();
        $this->setNotificationPreferences($assignee, optional: ['taskDueSoon']);
        $this->createTask($assignee->email, targetDeadlineAt: now()->addMinutes(30));

        Artisan::call('tasks:check-escalations');
        Artisan::call('tasks:check-escalations');

        $this->assertSame(1, Notification::where('user_id', $assignee->id)->where('type', 'task_due_soon')->count());
    }

    public function test_due_soon_notice_is_only_sent_to_an_assignee_who_opted_in(): void
    {
        $optedOut = $this->makeAssignee('opted-out@example.test');
        $optedIn = $this->makeAssignee('opted-in@example.test');
        $this->setNotificationPreferences($optedIn, optional: ['taskDueSoon']);

        $this->createTask($optedOut->email, targetDeadlineAt: now()->addMinutes(30));
        $this->createTask($optedIn->email, targetDeadlineAt: now()->addMinutes(30));

        Artisan::call('tasks:check-escalations');

        $this->assertSame(0, Notification::where('user_id', $optedOut->id)->where('type', 'task_due_soon')->count());
        $this->assertSame(1, Notification::where('user_id', $optedIn->id)->where('type', 'task_due_soon')->count());
    }

    public function test_a_task_far_from_its_deadline_triggers_no_notification(): void
    {
        $assignee = $this->makeAssignee();
        $this->createTask($assignee->email, targetDeadlineAt: now()->addDays(3));

        Artisan::call('tasks:check-escalations');

        $this->assertSame(0, Notification::where('user_id', $assignee->id)->count());
    }

    public function test_a_done_task_past_its_deadline_is_never_escalated(): void
    {
        $assignee = $this->makeAssignee();
        $taskId = $this->createTask($assignee->email, targetDeadlineAt: now()->subDay(), status: 'done');

        Artisan::call('tasks:check-escalations');

        $this->assertSame(0, Notification::where('user_id', $assignee->id)->count());
        $this->assertNull(DB::table('project_tasks')->where('id', $taskId)->value('escalated_at'));
    }

    /**
     * Deliberately runs the sweep under a non-UTC PHP runtime default
     * timezone (Pacific/Kiritimati, UTC+14) to prove the overdue comparison
     * is anchored to UTC epoch seconds (see CheckTaskEscalationsCommand)
     * rather than accidentally depending on PHP's ambient date.timezone.
     */
    public function test_escalation_comparison_is_independent_of_the_php_runtime_timezone(): void
    {
        $assignee = $this->makeAssignee();
        // 10 minutes overdue in UTC - if the comparison ever leaked a
        // +14:00 offset this would misclassify as still in the future.
        $this->createTask($assignee->email, targetDeadlineAt: now()->subMinutes(10));

        $previousTimezone = date_default_timezone_get();
        date_default_timezone_set('Pacific/Kiritimati');
        try {
            Artisan::call('tasks:check-escalations');
        } finally {
            date_default_timezone_set($previousTimezone);
        }

        $this->assertSame(1, Notification::where('user_id', $assignee->id)->where('type', 'task_escalation')->count());
    }

    public function test_disabling_the_policy_suppresses_the_entire_sweep(): void
    {
        DB::table('task_escalation_policies')->where('id', 'default')->update(['enabled' => false]);

        $assignee = $this->makeAssignee();
        $this->createTask($assignee->email, targetDeadlineAt: now()->subMinutes(10));

        Artisan::call('tasks:check-escalations');

        $this->assertSame(0, Notification::where('user_id', $assignee->id)->count());
    }

    private function makeAssignee(string $email = 'assignee@example.test'): User
    {
        return User::query()->create([
            'name' => 'Assignee',
            'email' => $email,
            'password' => Hash::make('secret-password'),
            'role' => 'editor',
        ]);
    }

    /**
     * @param  array<int, string>  $optional
     */
    private function setNotificationPreferences(User $user, array $optional): void
    {
        DB::table('user_experience_profiles')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'settings' => json_encode(['notifications' => ['dailyDigest' => false, 'optional' => $optional]]),
                'version' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );
    }

    private function createTask(string $assigneeEmail, \Illuminate\Support\Carbon $targetDeadlineAt, string $status = 'todo'): string
    {
        $projectId = (string) Str::uuid();
        DB::table('projects')->insert(['id' => $projectId, 'name' => 'Project', 'created_at' => now(), 'updated_at' => now()]);

        $taskId = (string) Str::uuid();
        DB::table('project_tasks')->insert([
            'id' => $taskId,
            'project_id' => $projectId,
            'title' => 'Task',
            'status' => $status,
            'assignee' => $assigneeEmail,
            'target_duration_minutes' => 60,
            'target_deadline_at' => $targetDeadlineAt,
            'created_at' => now()->subHours(2),
            'updated_at' => now()->subHours(2),
        ]);

        return $taskId;
    }
}
