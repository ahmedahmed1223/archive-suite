<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class NextIntegrationSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $uid = 'next-laravel-record';
        $token = env('ARCHIVE_E2E_SHARE_TOKEN', 'next-laravel-share');

        // Auth fixture so the harness can log in and exercise the protected
        // operational pages (/archive, /archive/[id], /media/jobs) which the
        // cookie-session middleware guards.
        User::updateOrCreate(
            ['email' => env('ARCHIVE_E2E_EMAIL', 'it@archive.test')],
            [
                'name' => 'Integration User',
                'password' => Hash::make(env('ARCHIVE_E2E_PASSWORD', 'password123')),
            ]
        );

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

        // A media job tied to the record above so /media/jobs renders a real row from Laravel.
        DB::table('media_jobs')->updateOrInsert(
            ['id' => 'next-laravel-media-job'],
            [
                'record_id' => $uid,
                'operation' => 'thumbnail',
                'status' => 'completed',
                'source_path' => null,
                'options' => json_encode([], JSON_UNESCAPED_UNICODE),
                'result' => json_encode([
                    'operation' => 'thumbnail',
                    'recordId' => $uid,
                    'artifacts' => [['kind' => 'thumbnail', 'key' => $uid.'/thumb.jpg']],
                ], JSON_UNESCAPED_UNICODE),
                'error' => null,
                'queued_at' => $now,
                'started_at' => $now,
                'completed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }
}
