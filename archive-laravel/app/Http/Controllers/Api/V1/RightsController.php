<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\RightsRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RightsController extends Controller
{
    private const LICENSE_TYPES = ['OWNED', 'LICENSED', 'PUBLIC_DOMAIN', 'FAIR_USE', 'UNKNOWN'];

    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'itemId' => ['required', 'string'],
        ]);

        $record = RightsRecord::query()->where('item_id', $validated['itemId'])->first();

        if (! $record) {
            return response()->json(['ok' => false, 'error' => 'No rights record found for this item.'], 404);
        }

        return response()->json(['ok' => true, 'record' => $this->formatRecord($record)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules(requireItem: true));

        $record = RightsRecord::query()->firstOrNew(['item_id' => $validated['itemId']]);

        if (! $record->exists) {
            $record->id = (string) Str::uuid();
        }

        $record->fill($this->toModelData($validated));
        $record->save();

        return response()->json(['ok' => true, 'record' => $this->formatRecord($record)], 201);
    }

    public function expiring(Request $request): JsonResponse
    {
        $days = max(1, min(365, (int) $request->query('days', 30)));
        $cutoff = now()->addDays($days);

        $records = RightsRecord::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '>', now())
            ->where('expires_at', '<=', $cutoff)
            ->orderBy('expires_at')
            ->get()
            ->map(fn (RightsRecord $record): array => $this->formatRecord($record))
            ->values();

        return response()->json(['ok' => true, 'records' => $records]);
    }

    public function enforcement(string $itemId): JsonResponse
    {
        $record = RightsRecord::query()->where('item_id', $itemId)->first();
        $now = now();
        $warnings = [];
        $allowed = true;
        $reason = 'allowed';

        if (! $record) {
            return response()->json([
                'ok' => true,
                'allowed' => true,
                'blocked' => false,
                'reason' => 'no_rights_record',
                'warnings' => ['No rights record exists for this item.'],
            ]);
        }

        if ($record->expires_at && $record->expires_at->lessThanOrEqualTo($now)) {
            $allowed = false;
            $reason = 'expired';
        }

        if ($record->embargo_start && $record->embargo_end && $now->between($record->embargo_start, $record->embargo_end)) {
            $allowed = false;
            $reason = 'embargoed';
        }

        if ($record->expires_at && $record->expires_at->greaterThan($now) && $record->expires_at->lessThanOrEqualTo($now->copy()->addDays(30))) {
            $warnings[] = 'Rights expire within 30 days.';
        }

        return response()->json([
            'ok' => true,
            'allowed' => $allowed,
            'blocked' => ! $allowed,
            'reason' => $reason,
            'warnings' => $warnings,
            'record' => $this->formatRecord($record),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $requireItem): array
    {
        return [
            'itemId' => [$requireItem ? 'required' : 'sometimes', 'string'],
            'rightsHolder' => ['required', 'string', 'max:255'],
            'licenseType' => ['required', 'string', Rule::in(self::LICENSE_TYPES)],
            'embargoStart' => ['nullable', 'date'],
            'embargoEnd' => ['nullable', 'date'],
            'expiresAt' => ['nullable', 'date'],
            'geoRestrictions' => ['nullable', 'array'],
            'geoRestrictions.*' => ['string', 'size:2'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ];
    }

    /**
     * @param array<string, mixed> $validated
     * @return array<string, mixed>
     */
    private function toModelData(array $validated): array
    {
        return [
            'item_id' => $validated['itemId'],
            'rights_holder' => $validated['rightsHolder'],
            'license_type' => $validated['licenseType'],
            'embargo_start' => $this->optionalDate($validated['embargoStart'] ?? null),
            'embargo_end' => $this->optionalDate($validated['embargoEnd'] ?? null),
            'expires_at' => $this->optionalDate($validated['expiresAt'] ?? null),
            'geo_restrictions' => $validated['geoRestrictions'] ?? [],
            'notes' => $validated['notes'] ?? null,
        ];
    }

    private function optionalDate(mixed $value): ?Carbon
    {
        return $value ? Carbon::parse((string) $value) : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRecord(RightsRecord $record): array
    {
        return [
            'id' => $record->id,
            'itemId' => $record->item_id,
            'rightsHolder' => $record->rights_holder,
            'licenseType' => $record->license_type,
            'embargoStart' => $record->embargo_start?->toISOString(),
            'embargoEnd' => $record->embargo_end?->toISOString(),
            'expiresAt' => $record->expires_at?->toISOString(),
            'geoRestrictions' => $record->geo_restrictions ?? [],
            'notes' => $record->notes,
            'createdAt' => $record->created_at?->toISOString(),
            'updatedAt' => $record->updated_at?->toISOString(),
        ];
    }
}
