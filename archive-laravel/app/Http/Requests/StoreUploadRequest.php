<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUploadRequest extends FormRequest
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
        $allowedExtensions = array_merge(
            (array) config('ingest.media_extensions', []),
            ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'zip'],
        );

        return [
            'file' => [
                'required',
                'file',
                'max:614400', // 600MB in kilobytes
                'extensions:'.implode(',', $allowedExtensions),
            ],
            'folder' => ['nullable', 'string', 'max:255'],
        ];
    }
}
