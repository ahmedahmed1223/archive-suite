<?php

namespace Tests\Unit;

use Tests\TestCase;

class ArchiveStorageConfigTest extends TestCase
{
    public function test_empty_optional_storage_paths_use_safe_application_defaults(): void
    {
        $this->assertSame(storage_path('app/private'), config('filesystems.disks.local.root'));
        $this->assertSame(storage_path('app/public'), config('filesystems.disks.public.root'));
    }

    public function test_default_media_root_matches_the_local_upload_disk(): void
    {
        $this->assertSame(
            storage_path('app/private'),
            config('archive.file_root'),
        );
    }
}
