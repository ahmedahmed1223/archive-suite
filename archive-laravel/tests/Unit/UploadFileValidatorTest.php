<?php

namespace Tests\Unit;

use App\Exceptions\UploadContentMismatchException;
use App\Services\Uploads\UploadFileValidator;
use PHPUnit\Framework\TestCase;

class UploadFileValidatorTest extends TestCase
{
    private UploadFileValidator $validator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->validator = new UploadFileValidator();
    }

    public function test_it_accepts_real_pdf_content_for_pdf_extension(): void
    {
        $this->validator->assertSafeContent("%PDF-1.4\n%\xe2\xe3\xcf\xd3\npadding", 'pdf');
        $this->addToAssertionCount(1);
    }

    public function test_it_accepts_real_jpeg_content_for_jpg_extension(): void
    {
        $this->validator->assertSafeContent("\xFF\xD8\xFF\xE0\x00\x10JFIF".str_repeat("\x00", 16), 'jpg');
        $this->addToAssertionCount(1);
    }

    public function test_it_rejects_a_php_script_disguised_as_jpg(): void
    {
        $this->expectException(UploadContentMismatchException::class);
        $this->validator->assertSafeContent("<?php echo shell_exec(\$_GET['x']); ?>", 'jpg');
    }

    public function test_it_rejects_php_content_regardless_of_extension(): void
    {
        $this->expectException(UploadContentMismatchException::class);
        $this->validator->assertSafeContent("<?php system(\$_GET['x']); ?>", 'txt');
    }

    public function test_it_rejects_zip_content_claiming_to_be_a_pdf(): void
    {
        $this->expectException(UploadContentMismatchException::class);
        $this->validator->assertSafeContent("PK\x03\x04".str_repeat("\x00", 16), 'pdf');
    }

    public function test_it_is_lenient_for_extensions_without_a_reliable_signature(): void
    {
        // mxf is not in the strict allow-list — plain unrecognized binary
        // content should pass as long as it isn't flagged as a script/exe.
        $this->validator->assertSafeContent(random_bytes(64), 'mxf');
        $this->addToAssertionCount(1);
    }

    public function test_it_accepts_empty_files(): void
    {
        $this->validator->assertSafeContent('', 'txt');
        $this->addToAssertionCount(1);
    }
}
