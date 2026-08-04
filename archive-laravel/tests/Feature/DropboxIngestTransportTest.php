<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Dropbox\DropboxConnectionService;
use App\Services\Dropbox\DropboxGateway;
use App\Services\Dropbox\DropboxIngestTransport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * V1-762: DropboxIngestTransport exercised directly (not through the
 * fake-bound container used by IngestApiTest) so the actual chunking/resume
 * logic runs against Http::fake, not FakeIngestTransport's empty stub.
 */
class DropboxIngestTransportTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private DropboxIngestTransport $transport;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('services.dropbox.client_id', 'test-client');
        config()->set('services.dropbox.client_secret', 'test-secret');
        Storage::fake(config('ingest.disk'));

        $this->user = User::query()->create([
            'name' => 'Editor', 'email' => 'dropbox-ingest@example.test',
            'password' => Hash::make('password'), 'role' => 'editor',
        ]);

        $gateway = new DropboxGateway();
        $connections = new DropboxConnectionService($gateway);
        $connections->connect($this->user, 'access-token', null, '/Archive');

        $this->transport = new DropboxIngestTransport($connections, $gateway);
    }

    public function test_pulls_a_small_file_in_a_single_request(): void
    {
        Http::fake([
            'api.dropboxapi.com/2/files/list_folder' => Http::response([
                'entries' => [
                    ['.tag' => 'file', 'name' => 'clip.mp4', 'path_display' => '/Archive/clip.mp4', 'size' => 11],
                ],
                'cursor' => 'cursor-1', 'has_more' => false,
            ]),
            'content.dropboxapi.com/2/files/download' => Http::response('hello world'),
        ]);

        $keys = $this->transport->pull(['user' => $this->user]);

        $this->assertSame(['ingest/clip.mp4'], $keys);
        Storage::disk(config('ingest.disk'))->assertExists('ingest/clip.mp4');
        $this->assertSame('hello world', Storage::disk(config('ingest.disk'))->get('ingest/clip.mp4'));

        Http::assertSent(fn ($request) => $request->url() === 'https://content.dropboxapi.com/2/files/download'
            && $request->header('Range')[0] === 'bytes=0-10');

        // The progress row is kept (status=complete), not deleted -- it is
        // what lets a later pull() recognize this exact path as already done
        // (see test_skips_a_file_already_marked_complete_...) without needing
        // the chunk files, which ARE deleted, to still exist.
        $this->assertSame('complete', DB::table('dropbox_download_progress')->value('status'));
    }

    public function test_downloads_a_large_file_across_multiple_range_requests_and_assembles_it(): void
    {
        config()->set('ingest.chunk_upload.max_chunk_bytes', 4);

        Http::fake([
            'api.dropboxapi.com/2/files/list_folder' => Http::response([
                'entries' => [
                    ['.tag' => 'file', 'name' => 'big.bin', 'path_display' => '/Archive/big.bin', 'size' => 10],
                ],
                'cursor' => 'cursor-1', 'has_more' => false,
            ]),
            'content.dropboxapi.com/2/files/download' => Http::sequence()
                ->push('abcd')  // bytes 0-3
                ->push('efgh')  // bytes 4-7
                ->push('ij'),   // bytes 8-9 (final, shorter chunk)
        ]);

        $keys = $this->transport->pull(['user' => $this->user]);

        $this->assertSame(['ingest/big.bin'], $keys);
        $this->assertSame('abcdefghij', Storage::disk(config('ingest.disk'))->get('ingest/big.bin'));

        $ranges = collect(Http::recorded())
            ->map(fn ($pair) => $pair[0]->header('Range')[0] ?? null)
            ->filter()
            ->values();
        $this->assertSame(['bytes=0-3', 'bytes=4-7', 'bytes=8-9'], $ranges->all());

        // The chunk files are cleaned up once assembled; the progress row is
        // kept (status=complete) as the marker a later pull() checks.
        Storage::disk(config('ingest.disk'))->assertDirectoryEmpty('ingest/dropbox-downloads');
        $this->assertSame('complete', DB::table('dropbox_download_progress')->value('status'));
    }

    public function test_resumes_from_the_last_downloaded_byte_instead_of_restarting(): void
    {
        config()->set('ingest.chunk_upload.max_chunk_bytes', 4);

        $connection = DB::table('dropbox_connections')->where('user_id', $this->user->id)->first();
        DB::table('dropbox_download_progress')->insert([
            'connection_id' => $connection->id, 'dropbox_path' => '/Archive/big.bin',
            'local_key' => 'ingest/big.bin', 'total_size' => 10, 'bytes_downloaded' => 4,
            'status' => 'downloading', 'created_at' => now(), 'updated_at' => now(),
        ]);
        // The first chunk "arrived" on an earlier, interrupted attempt.
        Storage::disk(config('ingest.disk'))->put('ingest/dropbox-downloads/'.$connection->id.'/'.sha1('/Archive/big.bin').'/0', 'abcd');

        Http::fake([
            'api.dropboxapi.com/2/files/list_folder' => Http::response([
                'entries' => [
                    ['.tag' => 'file', 'name' => 'big.bin', 'path_display' => '/Archive/big.bin', 'size' => 10],
                ],
                'cursor' => 'cursor-1', 'has_more' => false,
            ]),
            'content.dropboxapi.com/2/files/download' => Http::sequence()
                ->push('efgh')
                ->push('ij'),
        ]);

        $this->transport->pull(['user' => $this->user]);

        $this->assertSame('abcdefghij', Storage::disk(config('ingest.disk'))->get('ingest/big.bin'));

        // Only the two remaining chunks were requested -- never bytes 0-3 again.
        $ranges = collect(Http::recorded())
            ->map(fn ($pair) => $pair[0]->header('Range')[0] ?? null)
            ->filter()
            ->values();
        $this->assertSame(['bytes=4-7', 'bytes=8-9'], $ranges->all());
    }

    public function test_skips_a_file_already_marked_complete_without_any_download_request(): void
    {
        $connection = DB::table('dropbox_connections')->where('user_id', $this->user->id)->first();
        DB::table('dropbox_download_progress')->insert([
            'connection_id' => $connection->id, 'dropbox_path' => '/Archive/done.mp4',
            'local_key' => 'ingest/done.mp4', 'total_size' => 3, 'bytes_downloaded' => 3,
            'status' => 'complete', 'created_at' => now(), 'updated_at' => now(),
        ]);

        Http::fake([
            'api.dropboxapi.com/2/files/list_folder' => Http::response([
                'entries' => [
                    ['.tag' => 'file', 'name' => 'done.mp4', 'path_display' => '/Archive/done.mp4', 'size' => 3],
                ],
                'cursor' => 'cursor-1', 'has_more' => false,
            ]),
        ]);

        $keys = $this->transport->pull(['user' => $this->user]);

        $this->assertSame(['ingest/done.mp4'], $keys);
        Http::assertNotSent(fn ($request) => $request->url() === 'https://content.dropboxapi.com/2/files/download');
    }

    public function test_throws_when_dropbox_is_not_connected(): void
    {
        $stranger = User::query()->create([
            'name' => 'Stranger', 'email' => 'no-dropbox@example.test',
            'password' => Hash::make('password'), 'role' => 'editor',
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Dropbox is not connected.');

        $this->transport->pull(['user' => $stranger]);
    }

    /**
     * Found by the V1-X01 live storage run: ingest disks are configured
     * throw=false, so a failed chunk write returned false instead of raising.
     * Progress then advanced past bytes that never landed, assembly stitched a
     * short file, and the row was marked complete -- permanently, since a later
     * pull() short-circuits on status=complete. A write failure must abort.
     */
    public function test_a_failed_chunk_write_aborts_instead_of_completing_a_truncated_file(): void
    {
        Http::fake([
            'api.dropboxapi.com/2/files/list_folder' => Http::response([
                'entries' => [
                    ['.tag' => 'file', 'name' => 'clip.mp4', 'path_display' => '/Archive/clip.mp4', 'size' => 11],
                ],
                'cursor' => 'cursor-1', 'has_more' => false,
            ]),
            'content.dropboxapi.com/2/files/download' => Http::response('hello world'),
        ]);

        // Faithful stand-in for the pre-fix path: put() reports failure the way a
        // throw=false disk does, and the chunk it never wrote reads back as null.
        $failingDisk = \Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
        $failingDisk->shouldReceive('put')->andReturnFalse();
        $failingDisk->shouldReceive('get')->andReturnNull();
        $failingDisk->shouldReceive('deleteDirectory')->andReturnTrue();
        Storage::shouldReceive('disk')->andReturn($failingDisk);

        // Captured rather than expectException so the completion assertion below
        // still runs, and so PHPUnit's own failure (a RuntimeException subclass)
        // cannot be swallowed by the catch.
        $thrown = null;
        try {
            $this->transport->pull(['user' => $this->user]);
        } catch (\RuntimeException $e) {
            $thrown = $e;
        }

        $this->assertNotNull($thrown, 'A failed chunk write must not complete silently.');
        $this->assertStringContainsString('Unable to write Dropbox download chunk', $thrown->getMessage());

        $this->assertNotSame('complete', DB::table('dropbox_download_progress')->value('status'));
    }
}
