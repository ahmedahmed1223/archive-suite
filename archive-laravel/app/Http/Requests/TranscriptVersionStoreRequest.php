<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TranscriptVersionStoreRequest extends FormRequest
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
            'format' => ['required', 'string', 'in:srt,vtt'],
            'unlock' => ['nullable', 'boolean'],
            'cues' => ['required', 'array', 'min:1'],
            'cues.*.startSeconds' => ['required', 'numeric', 'min:0'],
            'cues.*.endSeconds' => ['required', 'numeric', 'min:0'],
            'cues.*.text' => ['required', 'string', 'max:10000'],
        ];
    }
}
