<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\MediaReviewComment;
use Illuminate\Foundation\Http\FormRequest;

class MediaReviewCommentCreateRequest extends FormRequest
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
            'store' => ['nullable', 'string'],
            'attachmentId' => ['nullable', 'uuid'],
            'reviewSessionId' => ['nullable', 'uuid'],
            'type' => ['required', 'string', 'in:'.implode(',', MediaReviewComment::TYPES)],
            'startSeconds' => ['required', 'numeric', 'min:0'],
            'endSeconds' => ['nullable', 'numeric', 'gt:startSeconds'],
            'body' => ['required', 'string', 'max:4000'],
            // Real media duration measured by the caller (the browser reads
            // this off the decoded file itself via HTMLMediaElement) -- see
            // MediaReviewCommentService::resolveKnownDuration() for how this
            // is cached and enforced server-side once known.
            'clientDurationSeconds' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
