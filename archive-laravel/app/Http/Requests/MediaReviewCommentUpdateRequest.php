<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\MediaReviewComment;
use Illuminate\Foundation\Http\FormRequest;

class MediaReviewCommentUpdateRequest extends FormRequest
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
            'type' => ['sometimes', 'string', 'in:'.implode(',', MediaReviewComment::TYPES)],
            'startSeconds' => ['sometimes', 'numeric', 'min:0'],
            // Not validated with gt:startSeconds here -- on a partial update
            // startSeconds may not be present in this request at all, so the
            // range check is done in the service against the merged values.
            'endSeconds' => ['nullable', 'numeric', 'min:0'],
            'body' => ['sometimes', 'string', 'max:4000'],
            'clientDurationSeconds' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
