<?php

namespace Tests\Unit;

use Tests\TestCase;

class ArchiveStorageConfigTest extends TestCase
{
    public function test_default_media_root_matches_the_local_upload_disk(): void
    {
        $this->assertSame(
            storage_path('app/private'),
            config('archive.file_root'),
        );
    }
}
