<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreReviewCommentRequest extends FormRequest
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
            'body' => ['required', 'string', 'max:4000'],
            'timecodeSeconds' => ['required', 'numeric', 'min:0'],
            // Optional normalized-coordinate rectangles ([0,1]) drawn on the frame.
            'annotation' => ['nullable', 'array', 'max:50'],
            'annotation.*.x' => ['required', 'numeric', 'min:0', 'max:1'],
            'annotation.*.y' => ['required', 'numeric', 'min:0', 'max:1'],
            'annotation.*.w' => ['required', 'numeric', 'min:0', 'max:1'],
            'annotation.*.h' => ['required', 'numeric', 'min:0', 'max:1'],
        ];
    }
}
