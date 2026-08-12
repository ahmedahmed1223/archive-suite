<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MediaJob extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'record_id',
        'created_by',
        'operation',
        'status',
        'executor',
        'contract_version',
        'source_path',
        'options',
        'result',
        'error',
        'progress_stage',
        'progress_percent',
        'queued_at',
        'started_at',
        'completed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'options' => 'array',
            'result' => 'array',
            'contract_version' => 'integer',
            'queued_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * Admin-or-creator visibility rule shared by MediaJobsController and the
     * media-job.{jobId} broadcast channel (routes/channels.php) — one
     * definition so live progress is never visible to a wider audience than
     * the job's own HTTP endpoints already allow.
     */
    public function isAccessibleBy(User $user): bool
    {
        return $user->role === 'admin' || (string) $this->created_by === (string) $user->id;
    }

    /**
     * Client-facing shape shared by MediaJobsController's HTTP responses and
     * MediaJobProgressUpdated's broadcast payload (RT-801) — one definition
     * so the two can never drift apart.
     *
     * @return array<string, mixed>
     */
    public function toApiPayload(): array
    {
        return [
            'id' => $this->id,
            'recordId' => $this->record_id,
            'operation' => $this->operation,
            'status' => $this->status,
            'executor' => $this->executor,
            'contractVersion' => $this->contract_version,
            'sourcePath' => $this->source_path,
            'options' => $this->options ?? [],
            'result' => $this->result,
            'error' => $this->error,
            'progressStage' => $this->progress_stage,
            'progressPercent' => $this->progress_percent,
            'queuedAt' => $this->queued_at?->toISOString(),
            'startedAt' => $this->started_at?->toISOString(),
            'completedAt' => $this->completed_at?->toISOString(),
        ];
    }
}
