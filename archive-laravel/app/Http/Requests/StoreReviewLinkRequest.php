<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Services\Media\MediaPathGuard;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReviewLinkRequest extends FormRequest
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
        $safePathRule = function (string $attribute, mixed $value, Closure $fail): void {
            if (! MediaPathGuard::isSafeRelative((string) $value)) {
                $fail("The {$attribute} must be a relative path without \"..\" traversal or an absolute path.");
            }
        };

        return [
            'permission' => ['nullable', 'string', Rule::in(['view', 'comment'])],
            'expiresAt' => ['nullable', 'date'],
            // V3-MEDIA-007: configurable duration, in addition to (or instead
            // of) an explicit expiresAt. Neither given still yields a
            // time-bounded link -- see ExternalReviewService::resolveExpiry().
            'durationHours' => ['nullable', 'numeric', 'min:0.1', 'max:8760'],
            'store' => ['nullable', 'string', 'max:255'],
            'attachmentId' => ['nullable', 'string', 'max:255'],
            // Trusted only from the authenticated internal creator (this
            // route requires requireEditor()) -- never taken from the public
            // reviewer. Fallback source when no derivative is attached or
            // the attached one isn't ready/current.
            'sourcePath' => ['nullable', 'string', 'max:2048', $safePathRule],
            'derivativeId' => ['nullable', 'string', 'max:255'],
            'allowDownload' => ['nullable', 'boolean'],
            'watermarkPolicy' => ['nullable', 'string', Rule::in(['none', 'visible'])],
            'requiredApprovals' => ['nullable', 'integer', Rule::in([1, 2])],
        ];
    }
}
