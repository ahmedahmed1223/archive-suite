<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSecuritySettingsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'accessTokenTtlMinutes' => ['integer', 'min:1', 'max:10080'],
            'perUserRateLimit' => ['integer', 'min:1', 'max:10000'],
            'webhookUrlAllowlist' => ['array'],
            'webhookUrlAllowlist.*' => ['url', 'regex:/^https:\/\//'],
            'legacyPasswordUpgrade' => ['boolean'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'accessTokenTtlMinutes.min' => 'Access token TTL must be at least 1 minute.',
            'perUserRateLimit.min' => 'Rate limit must be at least 1 request per minute.',
            'webhookUrlAllowlist.*.url' => 'Each webhook URL must be a valid URL.',
            'webhookUrlAllowlist.*.regex' => 'Each webhook URL must use HTTPS.',
        ];
    }

    /**
     * Get the validated input only for writable fields.
     *
     * @param string|array<string>|null $key
     * @param mixed $default
     *
     * @return mixed
     */
    public function validated($key = null, $default = null)
    {
        $validated = parent::validated($key, $default);

        if ($key !== null) {
            return $validated;
        }

        // Allowlist writable fields only — reject CSP, CORS, and other deploy-time settings
        $allowed = ['accessTokenTtlMinutes', 'perUserRateLimit', 'webhookUrlAllowlist', 'legacyPasswordUpgrade'];

        return array_intersect_key($validated, array_flip($allowed));
    }
}
