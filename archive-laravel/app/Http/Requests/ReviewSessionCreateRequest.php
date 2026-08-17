<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReviewSessionCreateRequest extends FormRequest
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
            'notes' => ['nullable', 'string', 'max:4000'],
        ];
    }
}
