<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Closure;
use DateTimeZone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class RescheduleUploadRequest extends FormRequest
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
            'scheduledAt' => [
                'required',
                'date',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (Carbon::parse((string) $value)->lt(now()->subSeconds(30))) {
                        $fail('The scheduled time must not be in the past.');
                    }
                },
            ],
            'timeZone' => [
                'required',
                'string',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! in_array((string) $value, DateTimeZone::listIdentifiers(), true)) {
                        $fail('The time zone must be a valid IANA time zone identifier.');
                    }
                },
            ],
            'version' => ['required', 'integer', 'min:1'],
        ];
    }
}
