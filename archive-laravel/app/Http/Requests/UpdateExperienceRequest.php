<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateExperienceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return collect(config('archive-settings.experience', []))
            ->mapWithKeys(fn (array $definition, string $key): array => [
                $key => ['sometimes', ...$definition['validation']],
            ])
            ->all();
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $known = array_keys((array) config('archive-settings.experience', []));

            if ($this->all() === []) {
                $validator->errors()->add('request', 'At least one experience setting is required.');
            }

            foreach (array_diff(array_keys($this->all()), $known) as $key) {
                $validator->errors()->add($key, 'Unknown experience setting.');
            }
        });
    }
}
