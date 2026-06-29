<?php

namespace Tests\Unit;

use App\Services\Ingest\FakeFtpClient;
use App\Services\Ingest\FtpIngestTransport;
use App\Services\Ingest\SmbIngestTransport;
use App\Services\Media\FakeProcessRunner;
use PHPUnit\Framework\TestCase;

class IngestTransportTest extends TestCase
{
    private string $testDir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->testDir = sys_get_temp_dir() . '/ingest_test_' . uniqid();
        mkdir($this->testDir, 0755, true);

        // Mock the config functions
        if (!function_exists('config')) {
            function config($key, $default = null) {
                $configs = [
                    'ingest.disk' => 'local',
                    'ingest.directory' => 'ingest',
                ];

                return $configs[$key] ?? $default;
            }
        }
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        // Clean up test directory
        if (is_dir($this->testDir)) {
            array_map('unlink', glob($this->testDir . '/*'));
            rmdir($this->testDir);
        }
    }

    public function test_ftp_transport_throws_on_missing_params(): void
    {
        // Arrange
        $ftpClient = new FakeFtpClient();
        $transport = new FtpIngestTransport($ftpClient);

        // Act & Assert
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('FTP pull requires host and user parameters');

        $transport->pull([
            'host' => 'ftp.example.com',
            // Missing user
            'password' => 'testpass',
        ]);
    }

    public function test_ftp_client_fake_stores_and_retrieves_files(): void
    {
        // Arrange
        $ftpClient = new FakeFtpClient();
        $ftpClient->setFileList('/uploads', [
            ['name' => 'video1.mp4', 'size' => 1024, 'type' => 'file'],
            ['name' => 'video2.mp4', 'size' => 2048, 'type' => 'file'],
        ]);
        $ftpClient->setFileContent('/uploads/video1.mp4', 'fake video 1 content');
        $ftpClient->setFileContent('/uploads/video2.mp4', 'fake video 2 content');

        // Act
        $files = $ftpClient->listFiles('/uploads');

        // Assert
        $this->assertCount(2, $files);
        $this->assertSame('video1.mp4', $files[0]['name']);
        $this->assertSame('video2.mp4', $files[1]['name']);

        // Verify download works
        $tempFile = $this->testDir . '/download.mp4';
        $ftpClient->downloadFile('/uploads/video1.mp4', $tempFile);
        $this->assertTrue(file_exists($tempFile));
        $this->assertSame('fake video 1 content', file_get_contents($tempFile));
    }

    public function test_ftp_client_fake_throws_on_missing_file(): void
    {
        // Arrange
        $ftpClient = new FakeFtpClient();

        // Act & Assert
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('file not found');

        $tempFile = $this->testDir . '/download.mp4';
        $ftpClient->downloadFile('/nonexistent.mp4', $tempFile);
    }

    public function test_smb_transport_throws_on_list_failure(): void
    {
        // Arrange
        $runner = new FakeProcessRunner();
        $runner->setResponse('default', [
            'exitCode' => 1,
            'stdout' => '',
            'stderr' => 'Authentication failed',
        ]);

        $transport = new SmbIngestTransport($runner);

        // Act & Assert
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('SMB list failed');

        $transport->pull([
            'host' => 'smb.example.com',
            'share' => 'media',
            'user' => 'testuser',
            'password' => 'testpass',
        ]);
    }

    public function test_smb_transport_throws_on_missing_params(): void
    {
        // Arrange
        $runner = new FakeProcessRunner();
        $transport = new SmbIngestTransport($runner);

        // Act & Assert
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('SMB pull requires host, share, and user parameters');

        $transport->pull([
            'host' => 'smb.example.com',
            // Missing share and user
            'password' => 'testpass',
        ]);
    }

    public function test_smb_transport_parses_listing_correctly(): void
    {
        // ponytail: Integration test with real parsing.
        // When real SMB servers are available, add a feature test against live server.

        // Arrange - test the parsing logic via reflection
        $runner = new FakeProcessRunner();
        $transport = new SmbIngestTransport($runner);

        $lsOutput = <<<'EOF'
.                                   D        0  Mon Jun 30 12:00:00 2024
..                                  D        0  Mon Jun 30 12:00:00 2024
subfolder                           D        0  Mon Jun 30 12:00:00 2024
video1.mp4                          A     1024  Mon Jun 30 12:00:00 2024
video2.mp4                          A     2048  Mon Jun 30 12:00:00 2024

		48384 blocks of size 1024. 24000 blocks available
EOF;

        // Use reflection to access the private parsing method
        $reflection = new \ReflectionClass($transport);
        $method = $reflection->getMethod('parseSmbclientListing');
        $method->setAccessible(true);

        // Act
        $files = $method->invoke($transport, $lsOutput);

        // Assert - should extract only non-directory files
        $this->assertContains('video1.mp4', $files);
        $this->assertContains('video2.mp4', $files);
        // Directories should not be included
        $this->assertNotContains('subfolder', $files);
        $this->assertNotContains('.', $files);
        $this->assertNotContains('..', $files);
    }
}
