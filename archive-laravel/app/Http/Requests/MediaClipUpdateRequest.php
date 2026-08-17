<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class MediaClipUpdateRequest extends FormRequest
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
            'title' => ['sometimes', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:4000'],
            // A partial time update must always supply both ends of the
            // range together -- that keeps the out > in check self-contained
            // in this request instead of requiring a DB round trip to merge
            // against whatever is currently stored. Deliberately no
            // "sometimes" here: it would short-circuit required_with on a
            // field that is itself absent, which is exactly the case this
            // rule needs to catch.
            'inSeconds' => ['numeric', 'min:0', 'required_with:outSeconds'],
            'outSeconds' => ['numeric', 'min:0', 'required_with:inSeconds'],
            'fps' => ['sometimes', 'integer', 'min:1', 'max:120'],
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
