<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Media\MediaPathGuard;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class NextIntegrationSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $uid = 'next-laravel-record';
        $videoUid = 'next-laravel-video-record';
        $token = env('ARCHIVE_E2E_SHARE_TOKEN', 'next-laravel-share');

        // Auth fixture so the harness can log in and exercise the protected
        // operational pages (/archive, /archive/[id], /media/jobs) which the
        // cookie-session middleware guards.
        User::updateOrCreate(
            ['email' => env('ARCHIVE_E2E_EMAIL', 'it@archive.test')],
            [
                'name' => 'Integration User',
                'password' => Hash::make(env('ARCHIVE_E2E_PASSWORD', 'password123')),
                'role' => 'admin',
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

        DB::table('storage_rows')->updateOrInsert(
            ['store' => 'archive', 'uid' => $videoUid],
            [
                'data' => json_encode([
                    'id' => $videoUid,
                    'title' => 'نشرة تكامل الفيديو',
                    'description' => 'مادة اختبار حي لبطاقة الفيديو التشغيلية.',
                    'type' => 'video',
                    'fileName' => 'integration-bulletin.mp4',
                    'checksum' => 'next-laravel-video-checksum',
                    'durationSeconds' => 62,
                    'tags' => ['integration', 'video'],
                ], JSON_UNESCAPED_UNICODE),
                'sync_version' => 1,
                'last_modified_by' => json_encode(['source' => 'NextIntegrationSeeder']),
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        $currentThumbnailId = '44444444-4444-4444-8444-444444444444';
        $staleThumbnailId = '55555555-5555-4555-8555-555555555555';
        $currentStorageKey = $videoUid.'/derivatives/current.jpg';
        $currentPath = app(MediaPathGuard::class)->resolveOutput($currentStorageKey, 'live integration thumbnail');
        file_put_contents($currentPath, base64_decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQL/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/If/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8h/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAgEBPyH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/If/Z'));

        // Rights are enforced closed: without a granted window the derivative
        // download is refused and the card has no thumbnail to show. The
        // fixture records the clearance the same way an operator would,
        // rather than the enforcement being weakened for tests.
        DB::table('rights_records')->updateOrInsert(
            ['item_id' => $videoUid],
            [
                'id' => 'rr-next-laravel-video',
                'rights_holder' => 'Integration Fixture',
                'license_type' => 'OWNED',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        foreach (['editorial_reuse', 'digital_public'] as $index => $usage) {
            DB::table('rights_windows')->updateOrInsert(
                ['id' => 'rw-next-laravel-video-'.$index],
                [
                    'rights_record_id' => 'rr-next-laravel-video',
                    'usage' => $usage,
                    'starts_at' => $now->copy()->subDay(),
                    'ends_at' => $now->copy()->addYear(),
                    'territories' => json_encode([]),
                    'platforms' => json_encode([]),
                    'granted' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        DB::table('media_derivatives')->updateOrInsert(
            ['id' => $currentThumbnailId],
            [
                'record_store' => 'archive',
                'record_uid' => $videoUid,
                'attachment_id' => null,
                'derivative_type' => 'thumbnail',
                'version_token' => 'record:next-laravel-video-checksum',
                'settings' => json_encode([]),
                'settings_hash' => hash('sha256', 'next-live-current-thumbnail'),
                'status' => 'ready',
                'storage_key' => $currentStorageKey,
                'media_job_id' => null,
                'error' => null,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        DB::table('media_derivatives')->updateOrInsert(
            ['id' => $staleThumbnailId],
            [
                'record_store' => 'archive',
                'record_uid' => $videoUid,
                'attachment_id' => null,
                'derivative_type' => 'thumbnail',
                'version_token' => 'record:replaced-video-source',
                'settings' => json_encode([]),
                'settings_hash' => hash('sha256', 'next-live-stale-thumbnail'),
                'status' => 'ready',
                'storage_key' => $videoUid.'/derivatives/stale.jpg',
                'media_job_id' => null,
                'error' => null,
                'created_by' => null,
                'created_at' => $now->copy()->addSecond(),
                'updated_at' => $now->copy()->addSecond(),
            ]
        );

        DB::table('media_derivatives')->updateOrInsert(
            ['id' => '66666666-6666-4666-8666-666666666666'],
            [
                'record_store' => 'archive',
                'record_uid' => $videoUid,
                'attachment_id' => null,
                'derivative_type' => 'proxy',
                'version_token' => 'record:next-laravel-video-checksum',
                'settings' => json_encode([]),
                'settings_hash' => hash('sha256', 'next-live-proxy'),
                'status' => 'processing',
                'storage_key' => null,
                'media_job_id' => null,
                'error' => null,
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        DB::table('media_inspections')->updateOrInsert(
            ['id' => '77777777-7777-4777-8777-777777777777'],
            [
                'record_store' => 'archive',
                'record_uid' => $videoUid,
                'inspection_type' => 'qc',
                'status' => 'passed',
                'version_token' => 'record:next-laravel-video-checksum',
                'report' => json_encode([]),
                'media_job_id' => null,
                'created_by' => null,
                'completed_at' => $now,
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
