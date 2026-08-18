<?php

declare(strict_types=1);

namespace App\Services\Settings;

use App\Models\User;
use App\Models\UserExperienceProfile;
use Illuminate\Support\Facades\DB;

class ExperienceProfileService
{
    /**
     * @return array{profileVersion: int, experience: array<string, array{value: mixed, source: string, editable: bool}>}
     */
    public function profile(User $user): array
    {
        $profile = UserExperienceProfile::query()->find($user->getKey());
        $stored = is_array($profile?->settings) ? $profile->settings : [];
        $experience = [];

        foreach ($this->definitions() as $key => $definition) {
            if (array_key_exists($key, $stored)) {
                $value = $stored[$key];
                $source = 'user';
            } elseif ($key === 'locale' && is_string($user->locale) && $user->locale !== '') {
                $value = $user->locale;
                $source = 'user';
            } else {
                $value = $definition['default'];
                $source = 'default';
            }

            if (($definition['type'] ?? null) === 'object') {
                $value = (object) $value;
            }

            $experience[$key] = [
                'value' => $value,
                'source' => $source,
                'editable' => true,
            ];
        }

        return [
            'profileVersion' => (int) ($profile?->version ?? 0),
            'experience' => $experience,
        ];
    }

    /** @param array<string, mixed> $values */
    public function update(User $user, array $values): void
    {
        DB::transaction(function () use ($user, $values): void {
            $profile = UserExperienceProfile::query()->lockForUpdate()->find($user->getKey());
            $settings = array_merge(is_array($profile?->settings) ? $profile->settings : [], $values);

            UserExperienceProfile::query()->updateOrCreate(
                ['user_id' => $user->getKey()],
                ['settings' => $settings, 'version' => ($profile?->version ?? 0) + 1],
            );

            if (array_key_exists('locale', $values)) {
                $user->forceFill(['locale' => $values['locale']])->save();
            }
        });
    }

    public function reset(User $user): void
    {
        DB::transaction(function () use ($user): void {
            UserExperienceProfile::query()->whereKey($user->getKey())->delete();
            $user->forceFill(['locale' => null])->save();
        });
    }

    /** @return array<string, array<string, mixed>> */
    private function definitions(): array
    {
        return (array) config('archive-settings.experience', []);
    }
}
