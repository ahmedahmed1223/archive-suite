<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PluginMarketplaceController extends Controller
{
    /** @var array<int, string> */
    private const STATUSES = ['reviewed', 'draft', 'blocked'];

    /** @var array<int, string> */
    private const CATEGORIES = ['metadata', 'workflow', 'ai', 'integration'];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in(self::STATUSES)],
            'category' => ['nullable', 'string', Rule::in(self::CATEGORIES)],
        ]);

        $plugins = collect(config('archive_plugins.plugins', []))
            ->map(fn (array $plugin): array => $this->normalizePlugin($plugin))
            ->filter(function (array $plugin) use ($validated): bool {
                if (($validated['status'] ?? null) && $plugin['status'] !== $validated['status']) {
                    return false;
                }

                if (($validated['category'] ?? null) && $plugin['category'] !== $validated['category']) {
                    return false;
                }

                return true;
            })
            ->values()
            ->all();

        return response()->json([
            'ok' => true,
            'runtimePolicy' => config('archive_plugins.runtimePolicy', []),
            'plugins' => $plugins,
            'permissionScopes' => $this->permissionScopes($plugins),
        ]);
    }

    /** @param array<string, mixed> $plugin
     *  @return array<string, mixed> */
    private function normalizePlugin(array $plugin): array
    {
        $permissions = array_values(array_map(
            fn (array $permission): array => [
                'scope' => (string) ($permission['scope'] ?? ''),
                'risk' => (string) ($permission['risk'] ?? 'medium'),
                'reason' => (string) ($permission['reason'] ?? ''),
            ],
            (array) ($plugin['permissions'] ?? [])
        ));

        return [
            'id' => (string) ($plugin['id'] ?? ''),
            'name' => (string) ($plugin['name'] ?? ''),
            'vendor' => (string) ($plugin['vendor'] ?? ''),
            'version' => (string) ($plugin['version'] ?? ''),
            'category' => (string) ($plugin['category'] ?? 'integration'),
            'summary' => (string) ($plugin['summary'] ?? ''),
            'status' => (string) ($plugin['status'] ?? 'draft'),
            'trustLevel' => (string) ($plugin['trustLevel'] ?? 'external'),
            'permissions' => $permissions,
            'securityReview' => [
                'networkAccess' => (bool) data_get($plugin, 'securityReview.networkAccess', false),
                'fileSystemAccess' => (bool) data_get($plugin, 'securityReview.fileSystemAccess', false),
                'executesCode' => (bool) data_get($plugin, 'securityReview.executesCode', false),
                'dataLeavesTenant' => (bool) data_get($plugin, 'securityReview.dataLeavesTenant', false),
                'adminApprovalRequired' => (bool) data_get($plugin, 'securityReview.adminApprovalRequired', true),
            ],
        ];
    }

    /** @param array<int, array<string, mixed>> $plugins
     *  @return array<int, array{scope: string, risk: string, pluginCount: int}> */
    private function permissionScopes(array $plugins): array
    {
        $scopes = [];

        foreach ($plugins as $plugin) {
            foreach ((array) $plugin['permissions'] as $permission) {
                $scope = (string) ($permission['scope'] ?? '');
                if ($scope === '') {
                    continue;
                }

                $risk = (string) ($permission['risk'] ?? 'medium');
                if (! isset($scopes[$scope])) {
                    $scopes[$scope] = ['scope' => $scope, 'risk' => $risk, 'pluginCount' => 0];
                }

                $scopes[$scope]['pluginCount']++;
                if ($risk === 'high' || ($risk === 'medium' && $scopes[$scope]['risk'] === 'low')) {
                    $scopes[$scope]['risk'] = $risk;
                }
            }
        }

        ksort($scopes);

        return array_values($scopes);
    }
}
