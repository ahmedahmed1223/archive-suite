<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DecideReviewLinkRequest extends FormRequest
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
            'reviewerName' => ['required', 'string', 'min:1', 'max:255'],
            'reviewerEmail' => ['nullable', 'email', 'max:255'],
            'decision' => ['required', 'string', Rule::in(['approve', 'request_changes'])],
            'notes' => ['nullable', 'string', 'max:4000'],
        ];
    }
}
