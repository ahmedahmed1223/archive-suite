<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateCapabilitiesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return collect(config('archive-settings.capabilities', []))
            ->mapWithKeys(fn (array $definition, string $key): array => [
                $key => ['sometimes', $definition['type'] === 'boolean' ? 'boolean' : 'present'],
            ])
            ->all();
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $known = array_keys((array) config('archive-settings.capabilities', []));

            if ($this->all() === []) {
                $validator->errors()->add('request', 'At least one capability setting is required.');
            }

            foreach (array_diff(array_keys($this->all()), $known) as $key) {
                $validator->errors()->add($key, 'Unknown capability setting.');
            }
        });
    }
}
