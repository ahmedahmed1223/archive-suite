<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Services\Storage\StorageCatalog;
use App\Services\Storage\StorageOperationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StorageOperationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_exposes_capabilities_without_secrets(): void
    {
        config()->set('filesystems.disks.s3', [
            'driver' => 's3', 'bucket' => 'archive', 'key' => 'super-secret-key', 'secret' => 'super-secret-value',
        ]);

        $entry = collect(app(StorageCatalog::class)->entries())->firstWhere('id', 's3');

        $this->assertSame('s3', $entry['type']);
        $this->assertSame('available', $entry['status']);
        $this->assertContains('copy', $entry['capabilities']);
        $this->assertStringNotContainsString('secret', json_encode($entry));
        $this->assertStringNotContainsString('super-secret-key', json_encode($entry));
        $this->assertStringNotContainsString('archive', json_encode($entry));
    }

    public function test_preview_is_signed_and_start_is_idempotent(): void
    {
        $service = app(StorageOperationService::class);
        $preview = $service->preview('copy', 'local', 's3', [['sourcePath' => 'in/a.pdf', 'destinationPath' => 'out/a.pdf']]);

        $first = $service->start($preview['previewToken'], 'test-copy-1', 1);
        $second = $service->start($preview['previewToken'], 'test-copy-1', 1);

        $this->assertSame($first->id, $second->id);
        $this->assertSame('queued', $first->status);
        $this->assertCount(1, $first->items);
        $this->assertSame('pending', $first->items->first()->status);
    }

    public function test_checksum_conflict_cancel_and_resume_state_are_durable(): void
    {
        $service = app(StorageOperationService::class);
        $preview = $service->preview('move', 'local', 's3', [[
            'sourcePath' => 'in/a.pdf', 'destinationPath' => 'out/a.pdf', 'expectedChecksum' => str_repeat('a', 64),
        ]]);
        $operation = $service->start($preview['previewToken'], 'test-move-1');

        $conflict = $service->recordChecksum($operation->items->first(), str_repeat('b', 64));
        $paused = $service->checkpoint($operation->fresh(), 0, 4096);
        $cancelled = $service->cancel($paused);

        $this->assertSame('conflict', $conflict->status);
        $this->assertSame('CHECKSUM_CONFLICT', $conflict->error_code);
        $this->assertSame(['nextItem' => 0, 'offset' => 4096], $paused->resume_state);
        $this->assertSame('cancelled', $cancelled->status);
        // A terminal checksum conflict is preserved for the user to resolve;
        // cancelling must only stop work that has not reached a result.
        $this->assertSame('conflict', $cancelled->items->first()->status);
    }
}
