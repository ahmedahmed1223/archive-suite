<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * V1-712 Task 3: safe projection of a ScheduledUpload row. Never serializes
 * `disk`/`staged_path` — those are internal storage locations, not something
 * the client needs or should be able to see.
 */
class ScheduledUploadResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'fileName' => $this->file_name, 'title' => data_get($this->record_payload, 'title'),
            'status' => $this->status, 'scheduledAt' => $this->scheduled_at?->toIso8601String(), 'timeZone' => $this->time_zone,
            'attempts' => $this->attempts, 'failureCode' => $this->failure_code, 'failureMessage' => $this->failure_message,
            'recordId' => $this->record_id, 'version' => $this->version,
            'createdAt' => $this->created_at?->toIso8601String(), 'updatedAt' => $this->updated_at?->toIso8601String(),
            'canReschedule' => $this->status === 'scheduled', 'canCancel' => $this->status === 'scheduled',
            'canRetry' => $this->status === 'failed' && str_starts_with((string) $this->failure_code, 'infrastructure_'),
        ];
    }
}
