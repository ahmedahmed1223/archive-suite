<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDisplaySettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'timeZone' => ['sometimes', 'string', 'timezone:all'],
            'dateFormat' => ['sometimes', 'string', 'in:DD/MM/YYYY,MM/DD/YYYY,YYYY-MM-DD'],
            'timeFormat' => ['sometimes', 'string', 'in:24h,12h'],
            'showSeconds' => ['sometimes', 'boolean'],
        ];
    }
}
