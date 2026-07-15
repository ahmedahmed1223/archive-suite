<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\StorageRowPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use JsonException;
use stdClass;

class RecordTranscriptController extends Controller
{
    /**
     * @throws JsonException
     */
    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $validated = $request->validate([
            'transcript' => ['required', 'string', 'max:1000000'],
            'store' => ['nullable', 'string'],
        ]);

        if (trim($validated['transcript']) === '') {
            return response()->json([
                'message' => 'The transcript field must not be blank.',
                'errors' => ['transcript' => ['The transcript field must not be blank.']],
            ], 422);
        }

        $row = DB::transaction(function () use ($id, $validated): ?stdClass {
            $row = DB::table('storage_rows')
                ->when(isset($validated['store']), fn ($query) => $query->where('store', $validated['store']))
                ->where(function ($query) use ($id): void {
                    $query->where('uid', $id)
                        ->orWhere('data->id', $id);
                })
                ->lockForUpdate()
                ->first();

            if (! $row instanceof stdClass) {
                return null;
            }

            $payload = json_decode((string) $row->data, true, 512, JSON_THROW_ON_ERROR);
            $payload = is_array($payload) ? $payload : [];
            $payload['transcript'] = $validated['transcript'];
            $now = now();

            DB::table('storage_rows')
                ->where('store', $row->store)
                ->where('uid', $row->uid)
                ->update([
                    'data' => json_encode($payload, JSON_THROW_ON_ERROR),
                    'updated_at' => $now,
                ]);

            $row->data = json_encode($payload, JSON_THROW_ON_ERROR);
            $row->updated_at = $now;

            return $row;
        });

        if (! $row instanceof stdClass) {
            return response()->json([
                'ok' => false,
                'error' => 'Record not found.',
                'code' => 'not_found',
            ], 404);
        }

        return response()->json([
            'ok' => true,
            'record' => StorageRowPayload::format($row),
        ]);
    }
}
