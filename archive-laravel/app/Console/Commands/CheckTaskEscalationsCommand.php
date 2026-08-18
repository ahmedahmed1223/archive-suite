<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Notification\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use stdClass;

/**
 * V3-WORK-002: SLA-style sweep over project_tasks.target_deadline_at.
 *
 * Idempotency: due_soon_notified_at / escalated_at are stamped on the task
 * row in the SAME pass that sends the notification, so a second run in the
 * same window sees the timestamp already set and skips it - the task row
 * itself is the dedupe key, no separate lock/log table needed. Repeat
 * overdue escalation is opt-in via task_escalation_policies.repeat_minutes
 * (null = escalate once, ever, per deadline).
 *
 * Timezone: target_deadline_at, escalated_at, and now() are all stored/read
 * in UTC (config('app.timezone') === 'UTC', same as every other timestamp
 * in this codebase - see DisplaySettingsService for the per-user *display*
 * timezone, which never affects this comparison). Comparisons below use raw
 * UTC epoch seconds so there is exactly one timezone convention in play,
 * never a second one derived from PHP's default timezone or a per-user
 * setting.
 *
 * Loop safety: this command only ever reads project_tasks /
 * task_escalation_policies and writes project_tasks + notifications. It
 * never touches storage_rows, never dispatches RecordChanged, and never
 * touches automation_rules - so it cannot trigger (or be triggered by)
 * AutomationRuleRunner. See that class's docblock for the equivalent
 * guarantee on the automation side.
 */
class CheckTaskEscalationsCommand extends Command
{
    protected $signature = 'tasks:check-escalations';

    protected $description = 'Send due-soon and overdue-escalation notifications for project tasks with a target deadline';

    public function handle(NotificationService $notifications): int
    {
        $policy = DB::table('task_escalation_policies')->where('id', 'default')->first();
        if (! $policy instanceof stdClass || ! (bool) $policy->enabled) {
            $this->info('Task escalation is disabled; nothing to do.');

            return 0;
        }

        $now = now();
        $dueSoonSent = 0;
        $escalatedSent = 0;

        $tasks = DB::table('project_tasks')
            ->whereNotNull('target_deadline_at')
            ->where('status', '!=', 'done')
            ->get();

        foreach ($tasks as $task) {
            $deadline = Carbon::parse($task->target_deadline_at, 'UTC');
            $minutesUntilDeadline = intdiv($deadline->getTimestamp() - $now->getTimestamp(), 60);

            if (
                $policy->warning_before_minutes !== null
                && $task->due_soon_notified_at === null
                && $minutesUntilDeadline >= 0
                && $minutesUntilDeadline <= (int) $policy->warning_before_minutes
            ) {
                $assignee = $this->resolveAssignee($task->assignee);
                if ($assignee) {
                    $notifications->createTaskDueSoonNotification($assignee, (string) $task->id, (string) $task->title, $deadline->toISOString());
                }
                DB::table('project_tasks')->where('id', $task->id)->update(['due_soon_notified_at' => $now]);
                $dueSoonSent++;
            }

            if ($minutesUntilDeadline >= 0) {
                continue;
            }

            $alreadyEscalated = $task->escalated_at !== null;
            $dueForRepeat = $alreadyEscalated
                && $policy->repeat_minutes !== null
                && Carbon::parse($task->escalated_at, 'UTC')->addMinutes((int) $policy->repeat_minutes)->getTimestamp() <= $now->getTimestamp();

            if ($alreadyEscalated && ! $dueForRepeat) {
                continue;
            }

            $assignee = $this->resolveAssignee($task->assignee);
            if ($assignee) {
                $notifications->createTaskEscalationNotification($assignee, (string) $task->id, (string) $task->title, $deadline->toISOString());
            }
            DB::table('project_tasks')->where('id', $task->id)->update(['escalated_at' => $now]);
            $escalatedSent++;
        }

        $this->info("Escalation sweep complete: {$dueSoonSent} due-soon, {$escalatedSent} overdue notifications.");

        return 0;
    }

    /**
     * project_tasks.assignee is a free-text label, not a user_id FK (same
     * limitation WorkInboxController::pendingTasks documents) - resolved
     * here by case-insensitive match against email/name. No match means no
     * personal notification is sent for that task; there is nobody to send
     * it to.
     */
    private function resolveAssignee(?string $assignee): ?User
    {
        $assignee = trim((string) $assignee);
        if ($assignee === '') {
            return null;
        }

        $needle = mb_strtolower($assignee);

        return User::query()
            ->whereRaw('LOWER(email) = ?', [$needle])
            ->orWhereRaw('LOWER(name) = ?', [$needle])
            ->first();
    }
}
