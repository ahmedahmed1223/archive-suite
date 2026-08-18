<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class MediaClipCreateRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:4000'],
            'inSeconds' => ['required', 'numeric', 'min:0'],
            'outSeconds' => ['required', 'numeric', 'min:0'],
            'fps' => ['nullable', 'integer', 'min:1', 'max:120'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $inSeconds = $this->input('inSeconds');
            $outSeconds = $this->input('outSeconds');

            if (is_numeric($inSeconds) && is_numeric($outSeconds) && (float) $outSeconds <= (float) $inSeconds) {
                $validator->errors()->add('outSeconds', 'outSeconds must be greater than inSeconds.');
            }
        });
    }
}
