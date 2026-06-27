<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class NextIntegrationSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $uid = 'next-laravel-record';
        $token = env('ARCHIVE_E2E_SHARE_TOKEN', 'next-laravel-share');

        DB::table('storage_rows')->updateOrInsert(
            ['store' => 'archive', 'uid' => $uid],
            [
                'data' => json_encode([
                    'id' => $uid,
                    'title' => 'تسجيل تكامل Next/Laravel',
                    'description' => 'Fixture يؤكد أن عارض المشاركة في Next يقرأ من Laravel API.',
                    'type' => 'document',
                    'tags' => ['integration', 'next', 'laravel'],
                ], JSON_UNESCAPED_UNICODE),
                'sync_version' => 1,
                'last_modified_by' => json_encode(['source' => 'NextIntegrationSeeder']),
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        DB::table('share_links')->updateOrInsert(
            ['token' => $token],
            [
                'scope' => json_encode(['itemIds' => [$uid]], JSON_UNESCAPED_UNICODE),
                'permission' => 'view',
                'expires_at' => null,
                'password_hash' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }
}
