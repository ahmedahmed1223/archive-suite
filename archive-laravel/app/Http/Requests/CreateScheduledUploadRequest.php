<?php

declare(strict_types=1);

namespace App\Http\Requests;

use DateTimeZone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

class CreateScheduledUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'uploadSessionId' => ['required', 'string'],
            'scheduledAt' => [
                'required',
                'date',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (Carbon::parse((string) $value)->lt(now()->subSeconds(30))) {
                        $fail('The scheduled time must not be in the past.');
                    }
                },
            ],
            'timeZone' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! in_array((string) $value, DateTimeZone::listIdentifiers(), true)) {
                        $fail('The time zone must be a valid IANA time zone identifier.');
                    }
                },
            ],
            'idempotencyKey' => ['required', 'string', 'min:16', 'max:128'],
            'record' => ['required', 'array'],
            'record.title' => ['required', 'string', 'max:255'],
            'record.type' => ['required', 'string', 'max:100'],
            'record.subtype' => ['nullable', 'string', 'max:100'],
            'record.tags' => ['nullable', 'array'],
            'record.metadata' => ['nullable', 'array'],
        ];
    }

    /**
     * Whitelisted record fields only — anything submitted under `record`
     * outside this list is dropped rather than stored.
     *
     * @return array<string, mixed>
     */
    public function recordPayload(): array
    {
        return Arr::only((array) $this->validated('record'), ['title', 'type', 'subtype', 'tags', 'metadata']);
    }
}
