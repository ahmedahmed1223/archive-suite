<?php

namespace Tests\Feature;

use AzureOss\Storage\Blob\BlobServiceClient;
use AzureOss\Storage\BlobFlysystem\AzureBlobStorageAdapter;
use Google\Cloud\Storage\StorageClient;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\Ftp\FtpAdapter;
use League\Flysystem\GoogleCloudStorage\GoogleCloudStorageAdapter;
use League\Flysystem\PhpseclibV3\SftpAdapter;
use Spatie\Dropbox\Client;
use Spatie\FlysystemDropbox\DropboxAdapter;
use Tests\TestCase;

/**
 * Offline-safe checks for the multi-cloud storage disks (azure, gcs, dropbox,
 * sftp, ftp) plus the S3-compatible endpoint knobs. No network calls: disk
 * resolution uses fake credentials, and the underlying adapters only connect
 * lazily on first read/write.
 */
class CloudStorageConfigTest extends TestCase
{
    public function test_s3_disk_exposes_endpoint_overrides_for_s3_compatible_services(): void
    {
        $this->assertSame('s3', config('filesystems.disks.s3.driver'));
        $this->assertArrayHasKey('endpoint', config('filesystems.disks.s3'));
        $this->assertArrayHasKey('use_path_style_endpoint', config('filesystems.disks.s3'));
    }

    public function test_azure_disk_is_configured_and_adapter_class_exists(): void
    {
        $this->assertSame('azure', config('filesystems.disks.azure.driver'));
        $this->assertTrue(class_exists(AzureBlobStorageAdapter::class));
        $this->assertTrue(class_exists(BlobServiceClient::class));
    }

    public function test_azure_disk_resolves_with_fake_development_connection_string(): void
    {
        config()->set('filesystems.disks.azure.connection_string', 'UseDevelopmentStorage=true');
        config()->set('filesystems.disks.azure.container', 'test-container');

        $disk = Storage::disk('azure');

        $this->assertInstanceOf(FilesystemAdapter::class, $disk);
    }

    public function test_gcs_disk_is_configured_and_adapter_class_exists(): void
    {
        $this->assertSame('gcs', config('filesystems.disks.gcs.driver'));
        $this->assertTrue(class_exists(GoogleCloudStorageAdapter::class));
        $this->assertTrue(class_exists(StorageClient::class));
    }

    public function test_gcs_disk_resolves_with_fake_project_and_no_key_file(): void
    {
        // No key_file: SDK falls back to Application Default Credentials, which
        // is not fetched until an actual API call is made.
        config()->set('filesystems.disks.gcs.project_id', 'test-project');
        config()->set('filesystems.disks.gcs.bucket', 'test-bucket');
        config()->set('filesystems.disks.gcs.key_file', null);

        $disk = Storage::disk('gcs');

        $this->assertInstanceOf(FilesystemAdapter::class, $disk);
    }

    public function test_dropbox_disk_is_configured_and_adapter_class_exists(): void
    {
        $this->assertSame('dropbox', config('filesystems.disks.dropbox.driver'));
        $this->assertTrue(class_exists(DropboxAdapter::class));
        $this->assertTrue(class_exists(Client::class));
    }

    public function test_dropbox_disk_resolves_with_fake_token(): void
    {
        config()->set('filesystems.disks.dropbox.token', 'fake-access-token');

        $disk = Storage::disk('dropbox');

        $this->assertInstanceOf(FilesystemAdapter::class, $disk);
    }

    public function test_sftp_disk_is_configured_and_adapter_class_exists(): void
    {
        $this->assertSame('sftp', config('filesystems.disks.sftp.driver'));
        $this->assertTrue(class_exists(SftpAdapter::class));
    }

    public function test_sftp_disk_resolves_with_fake_credentials(): void
    {
        // phpseclib-based provider connects lazily on first filesystem
        // operation, so resolving the disk performs no network I/O.
        config()->set('filesystems.disks.sftp.host', 'sftp.example.test');
        config()->set('filesystems.disks.sftp.username', 'fake-user');
        config()->set('filesystems.disks.sftp.password', 'fake-password');

        $disk = Storage::disk('sftp');

        $this->assertInstanceOf(FilesystemAdapter::class, $disk);
    }

    public function test_ftp_disk_is_configured_and_adapter_class_exists(): void
    {
        $this->assertSame('ftp', config('filesystems.disks.ftp.driver'));
        $this->assertTrue(class_exists(FtpAdapter::class));
    }

    public function test_ftp_disk_resolves_with_fake_credentials(): void
    {
        // ponytail: league/flysystem-ftp's FtpConnectionOptions::fromArray()
        // evaluates a default `?? FTP_BINARY`, which requires PHP's ext-ftp to
        // even be *loaded* (not just connected) or it throws "Undefined
        // constant". The composer:latest CI image used to run this suite has
        // no ext-ftp, so we skip the resolution assertion there — the disk
        // still needs the extension in any real deployment target.
        if (! extension_loaded('ftp')) {
            $this->markTestSkipped('ext-ftp is not loaded in this PHP runtime.');
        }

        config()->set('filesystems.disks.ftp.host', 'ftp.example.test');
        config()->set('filesystems.disks.ftp.username', 'fake-user');
        config()->set('filesystems.disks.ftp.password', 'fake-password');

        $disk = Storage::disk('ftp');

        $this->assertInstanceOf(FilesystemAdapter::class, $disk);
    }
}
