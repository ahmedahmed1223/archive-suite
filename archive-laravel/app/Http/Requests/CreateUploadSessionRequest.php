<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateUploadSessionRequest extends FormRequest
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
            // No upper bound here beyond the capacity guard (free space/quota)
            // — allowing files past the single-shot 600MB cap is the point.
            // `extensions:` validates an UploadedFile object; fileName here is
            // a plain string (the chunks, not the whole file, cross the wire
            // for /create), so the extension is checked with a closure instead.
            'fileName' => [
                'required',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($allowedExtensions): void {
                    $extension = strtolower((string) pathinfo((string) $value, PATHINFO_EXTENSION));
                    if ($extension === '' || ! in_array($extension, $allowedExtensions, true)) {
                        $fail('The file extension is not allowed.');
                    }
                },
            ],
            'totalSize' => ['required', 'integer', 'min:1'],
            'chunkSize' => [
                'required',
                'integer',
                'min:'.(int) config('ingest.chunk_upload.min_chunk_bytes'),
                'max:'.(int) config('ingest.chunk_upload.max_chunk_bytes'),
            ],
            'folder' => ['nullable', 'string', 'max:255'],
            'checksum' => ['nullable', 'string', 'size:64', 'regex:/^[a-f0-9]{64}$/i'],
        ];
    }
}
