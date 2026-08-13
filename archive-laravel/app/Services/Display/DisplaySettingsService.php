<?php

declare(strict_types=1);

namespace App\Services\Display;

use App\Models\StorageRow;

class DisplaySettingsService
{
    private const STORE = 'display-settings';

    private const UID = 'display-settings';

    /** @var array<string, mixed> */
    private const DEFAULTS = [
        'timeZone' => 'Europe/Istanbul',
        'dateFormat' => 'DD/MM/YYYY',
        'timeFormat' => '24h',
        'showSeconds' => false,
    ];

    /**
     * @return array{timeZone: string, dateFormat: string, timeFormat: string, showSeconds: bool}
     */
    public function getSettings(): array
    {
        $settings = array_merge(self::DEFAULTS, $this->overrides());

        return [
            'timeZone' => (string) $settings['timeZone'],
            'dateFormat' => (string) $settings['dateFormat'],
            'timeFormat' => (string) $settings['timeFormat'],
            'showSeconds' => (bool) $settings['showSeconds'],
        ];
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    public function update(array $settings): void
    {
        StorageRow::query()->updateOrCreate(
            ['store' => self::STORE, 'uid' => self::UID],
            ['data' => array_merge($this->overrides(), $settings)],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function overrides(): array
    {
        $row = StorageRow::query()
            ->where('store', self::STORE)
            ->where('uid', self::UID)
            ->first();

        return is_array($row?->data) ? $row->data : [];
    }
}
