<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\RightsRecord;
use App\Models\RightsWindow;
use App\Support\ApiError;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Rights windows are what the decision service actually reads (see
 * RightsDecisionService and docs/v2-rights-decision-design.ar.md): a record
 * says who holds the rights, a window says which usage is granted, when,
 * where and on what platforms.
 *
 * Until this controller existed the table could only be written directly in
 * the database, which meant the deny-by-default rule refused every share,
 * review link, derivative download and montage export with no way for an
 * operator to grant anything.
 */
class RightsWindowsController extends Controller
{
    /** The four usages the decision service recognizes. */
    public const USAGES = ['broadcast', 'digital_public', 'internal_archive', 'editorial_reuse'];

    public function index(string $itemId): JsonResponse
    {
        $record = RightsRecord::query()->where('item_id', $itemId)->first();
        if (! $record instanceof RightsRecord) {
            return response()->json(ApiError::envelope('No rights record found for this item.', 404), 404);
        }

        return response()->json([
            'ok' => true,
            'windows' => $record->windows()
                ->orderBy('usage')
                ->orderBy('starts_at')
                ->get()
                ->map(fn (RightsWindow $window): array => $this->format($window))
                ->values(),
        ]);
    }

    public function store(Request $request, string $itemId): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $record = RightsRecord::query()->where('item_id', $itemId)->first();
        if (! $record instanceof RightsRecord) {
            // The holder and licence live on the record, so a window cannot
            // stand on its own -- the operator records the rights first.
            return response()->json(ApiError::envelope('Create the rights record for this item before adding windows.', 404), 404);
        }

        $validated = $request->validate($this->rules(requireUsage: true));

        $window = new RightsWindow(['id' => (string) Str::uuid()]);
        $window->rights_record_id = $record->id;
        $window->fill($this->toModelData($validated));
        $window->save();

        return response()->json(['ok' => true, 'window' => $this->format($window)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $window = RightsWindow::query()->find($id);
        if (! $window instanceof RightsWindow) {
            return response()->json(ApiError::envelope('Rights window not found.', 404), 404);
        }

        $validated = $request->validate($this->rules(requireUsage: false));
        $window->fill($this->toModelData($validated, $window));
        $window->save();

        return response()->json(['ok' => true, 'window' => $this->format($window)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($denied = $this->requireEditor($request)) {
            return $denied;
        }

        $window = RightsWindow::query()->find($id);
        if (! $window instanceof RightsWindow) {
            return response()->json(ApiError::envelope('Rights window not found.', 404), 404);
        }

        $window->delete();

        return response()->json(['ok' => true, 'deleted' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $requireUsage): array
    {
        return [
            'usage' => [$requireUsage ? 'required' : 'sometimes', 'string', Rule::in(self::USAGES)],
            'startsAt' => ['nullable', 'date'],
            // after_or_equal rather than after: a window may be recorded as a
            // single instant, and refusing that would be arbitrary.
            'endsAt' => ['nullable', 'date', 'after_or_equal:startsAt'],
            // An empty list means "unrestricted", never "nothing allowed" --
            // the decision service treats it that way and the two must agree.
            'territories' => ['nullable', 'array'],
            'territories.*' => ['string', 'size:2'],
            'platforms' => ['nullable', 'array'],
            'platforms.*' => ['string', 'max:64'],
            'granted' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function toModelData(array $validated, ?RightsWindow $current = null): array
    {
        $data = [];
        foreach (['usage' => 'usage', 'startsAt' => 'starts_at', 'endsAt' => 'ends_at', 'territories' => 'territories', 'platforms' => 'platforms', 'granted' => 'granted'] as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $data[$column] = $validated[$input];
            }
        }

        if (! array_key_exists('granted', $data) && $current === null) {
            $data['granted'] = true;
        }
        $data['territories'] ??= $current?->territories ?? [];
        $data['platforms'] ??= $current?->platforms ?? [];

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    private function format(RightsWindow $window): array
    {
        return [
            'id' => $window->id,
            'rightsRecordId' => $window->rights_record_id,
            'usage' => $window->usage,
            'startsAt' => $window->starts_at?->toISOString(),
            'endsAt' => $window->ends_at?->toISOString(),
            'territories' => $window->territories ?? [],
            'platforms' => $window->platforms ?? [],
            'granted' => (bool) $window->granted,
            'createdAt' => $window->created_at?->toISOString(),
            'updatedAt' => $window->updated_at?->toISOString(),
        ];
    }
}
