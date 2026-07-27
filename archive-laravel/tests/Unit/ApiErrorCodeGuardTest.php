<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * V1-815: every manually-built {ok:false,error} envelope must carry a
 * machine-readable `code` so the frontend can eventually branch on it
 * instead of matching raw Laravel error text. Static scan over source,
 * not a request test — catches the mistake before it ships rather than
 * per-endpoint.
 */
class ApiErrorCodeGuardTest extends TestCase
{
    public function test_no_raw_ok_false_response_is_missing_a_code(): void
    {
        $root = dirname(__DIR__, 2).'/app';
        $offenders = [];

        foreach ($this->phpFiles($root) as $file) {
            $contents = file_get_contents($file);

            if ($contents === false || ! str_contains($contents, "'ok' => false")) {
                continue;
            }

            foreach ($this->findRawEnvelopesMissingCode($contents) as $line) {
                $offenders[] = $file.':'.$line;
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "Found manual {ok:false} responses without a 'code' key. Use ApiError::envelope() ".
            "(see app/Support/ApiError.php) instead of a raw array so the frontend can branch on ".
            "code rather than matching English error text:\n".implode("\n", $offenders)
        );
    }

    /**
     * @return list<int> 1-indexed line numbers of offending 'ok' => false occurrences
     */
    private function findRawEnvelopesMissingCode(string $contents): array
    {
        $lines = [];

        foreach (explode("\n", $contents) as $index => $line) {
            if (! str_contains($line, "'ok' => false")) {
                continue;
            }

            // A window around the match covers both single-line envelopes
            // and multi-line array literals where 'code' sits a few lines
            // below 'ok' => false.
            $windowStart = max(0, $index - 2);
            $window = implode("\n", array_slice(explode("\n", $contents), $windowStart, 8));

            $hasCode = str_contains($window, "'code'")
                || str_contains($window, 'ApiError::envelope');

            if (! $hasCode) {
                $lines[] = $index + 1;
            }
        }

        return $lines;
    }

    /**
     * @return list<string>
     */
    private function phpFiles(string $root): array
    {
        $files = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root));

        foreach ($iterator as $fileInfo) {
            if ($fileInfo->isFile() && $fileInfo->getExtension() === 'php') {
                // Console commands write to CLI stdout, not HTTP API responses —
                // out of scope for the frontend-facing error envelope contract.
                if (str_contains($fileInfo->getPathname(), DIRECTORY_SEPARATOR.'Console'.DIRECTORY_SEPARATOR)) {
                    continue;
                }

                $files[] = $fileInfo->getPathname();
            }
        }

        return $files;
    }
}
