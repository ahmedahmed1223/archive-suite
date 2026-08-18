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
        $rules = collect(config('archive-settings.capabilities', []))
            ->mapWithKeys(fn (array $definition, string $key): array => [
                $key => ['sometimes', $definition['type'] === 'boolean' ? 'boolean' : 'present'],
            ])
            ->all();

        $rules['expectedVersions'] = ['sometimes', 'array'];
        $rules['expectedVersions.*'] = ['integer', 'min:0'];

        return $rules;
    }

    /** @return array<string, bool> */
    public function values(): array
    {
        return collect($this->validated())->except('expectedVersions')->all();
    }

    /** @return array<string, int> */
    public function expectedVersions(): array
    {
        return (array) ($this->validated()['expectedVersions'] ?? []);
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $known = array_keys((array) config('archive-settings.capabilities', []));
            $submitted = collect($this->all())->except('expectedVersions')->keys()->all();

            if ($submitted === []) {
                $validator->errors()->add('request', 'At least one capability setting is required.');
            }

            foreach (array_diff($submitted, $known) as $key) {
                $validator->errors()->add($key, 'Unknown capability setting.');
            }

            foreach (array_diff(array_keys((array) $this->input('expectedVersions', [])), $known) as $key) {
                $validator->errors()->add("expectedVersions.{$key}", 'Unknown capability setting.');
            }
        });
    }
}
