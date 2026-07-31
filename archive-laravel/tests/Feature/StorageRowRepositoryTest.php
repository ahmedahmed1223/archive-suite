<?php

namespace Tests\Feature;

use App\Repositories\StorageRowRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StorageRowRepositoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_preserves_the_store_uid_composite_identity_for_all_writes(): void
    {
        $repository = app(StorageRowRepository::class);
        $now = now();

        $repository->insert('archive-items', 'shared-id', [
            'data' => json_encode(['id' => 'shared-id', 'title' => 'Archive']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $repository->insert('types', 'shared-id', [
            'data' => json_encode(['id' => 'shared-id', 'title' => 'Type']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $repository->upsert('archive-items', 'shared-id', [
            'data' => json_encode(['id' => 'shared-id', 'title' => 'Updated archive']),
            'updated_at' => $now,
        ]);

        $this->assertStringContainsString('Updated archive', (string) $repository->find('archive-items', 'shared-id')?->data);
        $this->assertStringContainsString('Type', (string) $repository->find('types', 'shared-id')?->data);
        $rows = $repository->findManyByKeys([
            ['store' => 'types', 'uid' => 'shared-id'],
            ['store' => 'archive-items', 'uid' => 'shared-id'],
        ]);
        $this->assertCount(2, $rows);
        $this->assertStringContainsString('Type', (string) $rows->get($repository->key('types', 'shared-id'))?->data);
        $this->assertSame(1, $repository->delete('archive-items', 'shared-id'));
        $this->assertNull($repository->find('archive-items', 'shared-id'));
        $this->assertNotNull($repository->find('types', 'shared-id'));
    }

    public function test_it_finds_every_row_matching_a_store_scoped_record_identifier(): void
    {
        $repository = app(StorageRowRepository::class);
        $now = now();

        $repository->insert('archive-items', 'canonical-id', [
            'data' => json_encode(['id' => 'canonical-id']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $repository->insert('archive-items', 'legacy-id', [
            'data' => json_encode(['id' => 'canonical-id']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $repository->insert('types', 'canonical-id', [
            'data' => json_encode(['id' => 'canonical-id']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $rows = $repository->findManyByUidOrRecordId('archive-items', 'canonical-id');

        $this->assertCount(2, $rows);
        $this->assertSame(['canonical-id', 'legacy-id'], $rows->pluck('uid')->all());
    }
}
