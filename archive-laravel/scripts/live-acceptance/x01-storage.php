<?php

/**
 * V1-X01 live external-storage driver.
 *
 * Runs the *product* storage path (Storage::disk) against a real S3-compatible
 * endpoint and emits JSON on stdout. It never prints credentials: every value it
 * reports is either a boolean, a checksum, a size, or an error string passed
 * through redact().
 *
 * Phases are separate processes on purpose so the orchestrator can pause the
 * provider container between them to produce a genuine interruption.
 *
 * Usage: php x01-storage.php <identity|rwd|large|expect-failure|integrity> [sizeMb]
 */

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Services\Storage\FlysystemStorageAdapter;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Storage;

const PREFIX = 'v1-x01-live';

/** Redact anything that looks like the configured credentials or a signed URL. */
function redact(string $text): string
{
    foreach (['AWS_SECRET_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'DROPBOX_ACCESS_TOKEN'] as $name) {
        $value = (string) env($name, '');
        if (strlen($value) >= 4) {
            $text = str_replace($value, '[REDACTED]', $text);
        }
    }

    return preg_replace('/(X-Amz-Signature|Signature|PWD|password)=[^&\s;]+/i', '$1=[REDACTED]', $text) ?? $text;
}

function emit(array $payload): void
{
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
}

/** 1 MiB of varied deterministic data; flat bytes would hide transfer bugs. */
function megabyte(): string
{
    static $chunk = null;
    if ($chunk === null) {
        $chunk = '';
        for ($i = 0; $i < 32768; $i++) {
            $chunk .= hash('sha256', "v1-x01-block-{$i}", true); // 32 bytes each => 1 MiB
        }
    }

    return $chunk;
}

/**
 * Stage the payload on disk rather than in a string. A multi-GiB archive object
 * must never need to fit in memory, and buffering it here would only prove the
 * harness can hold it -- an earlier 64 MiB buffered run died on memory_limit.
 *
 * @return array{handle: resource, sha256: string, bytes: int}
 */
function stagePayload(int $sizeMb): array
{
    $handle = fopen('php://temp/maxmemory:1048576', 'r+');
    $hash = hash_init('sha256');
    $bytes = 0;
    for ($i = 0; $i < max(1, $sizeMb); $i++) {
        $mb = megabyte();
        fwrite($handle, $mb);
        hash_update($hash, $mb);
        $bytes += strlen($mb);
    }
    rewind($handle);

    return ['handle' => $handle, 'sha256' => hash_final($hash), 'bytes' => $bytes];
}

/** Hash a stream incrementally so verification is memory-flat too. */
function hashStream($stream): string
{
    $hash = hash_init('sha256');
    while (! feof($stream)) {
        $buffer = fread($stream, 1048576);
        if ($buffer === false) {
            break;
        }
        hash_update($hash, $buffer);
    }

    return hash_final($hash);
}

$phase = $argv[1] ?? 'identity';
$sizeMb = (int) ($argv[2] ?? 64);
$disk = Storage::disk('s3');

try {
    if ($phase === 'identity') {
        $key = PREFIX.'/identity-probe.txt';
        $disk->put($key, 'identity');
        $found = $disk->exists($key);
        $disk->delete($key);
        emit([
            'phase' => 'identity',
            'ok' => $found,
            'driver' => config('filesystems.disks.s3.driver'),
            'bucketConfigured' => trim((string) config('filesystems.disks.s3.bucket')) !== '',
            'endpointConfigured' => trim((string) config('filesystems.disks.s3.endpoint')) !== '',
            'pathStyle' => (bool) config('filesystems.disks.s3.use_path_style_endpoint'),
            'credentialsConfigured' => trim((string) config('filesystems.disks.s3.key')) !== ''
                && trim((string) config('filesystems.disks.s3.secret')) !== '',
        ]);
        exit(0);
    }

    if ($phase === 'rwd') {
        $key = PREFIX.'/rwd.bin';
        $body = random_bytes(2048);
        $disk->put($key, $body);
        $readBack = $disk->get($key);
        $existsBefore = $disk->exists($key);
        $disk->delete($key);
        $existsAfter = $disk->exists($key);
        emit([
            'phase' => 'rwd',
            'ok' => $existsBefore && ! $existsAfter && hash('sha256', (string) $readBack) === hash('sha256', $body),
            'wroteSha256' => hash('sha256', $body),
            'readSha256' => hash('sha256', (string) $readBack),
            'existsAfterWrite' => $existsBefore,
            'existsAfterDelete' => $existsAfter,
        ]);
        exit(0);
    }

    if ($phase === 'large') {
        $key = PREFIX.'/large.bin';
        $staged = stagePayload($sizeMb);
        $adapter = new FlysystemStorageAdapter($disk);
        try {
            $started = microtime(true);
            $adapter->writeStream($key, $staged['handle']);
            $uploadSeconds = microtime(true) - $started;
            $readStream = $adapter->readStream($key);
            $actual = hashStream($readStream);
            fclose($readStream);
            $size = $disk->size($key);
            emit([
                'phase' => 'large',
                'ok' => $staged['sha256'] === $actual && $size === $staged['bytes'],
                'sizeBytes' => $size,
                'requestedMb' => $sizeMb,
                'streamed' => true,
                'peakMemoryBytes' => memory_get_peak_usage(true),
                'sha256Match' => $staged['sha256'] === $actual,
                'uploadSeconds' => round($uploadSeconds, 2),
            ]);
        } finally {
            // Always drop the object, so a mid-phase failure cannot leave residue
            // that the integrity phase would then misreport as a partial write.
            $disk->delete($key);
            if (is_resource($staged['handle'])) {
                fclose($staged['handle']);
            }
        }
        exit(0);
    }

    // Run while the provider is down. Pass condition: the product path fails
    // loudly. Also records what the raw disk does, because disks are configured
    // throw=false and that difference is exactly where a silent truncation bug
    // was found (DropboxIngestTransport, commit 493c026c).
    if ($phase === 'expect-failure') {
        $key = PREFIX.'/interrupted.bin';
        // A few MiB is plenty to prove outage handling; the size path is the
        // large phase's job.
        $staged = stagePayload(4);

        $rawReturned = null;
        $rawThrew = false;
        try {
            $rawReturned = $disk->put($key, $staged['handle']);
        } catch (Throwable $e) {
            $rawThrew = true;
        }

        rewind($staged['handle']);
        $productThrew = false;
        $error = '';
        try {
            (new FlysystemStorageAdapter($disk))->writeStream($key, $staged['handle']);
        } catch (Throwable $e) {
            $productThrew = true;
            $error = redact($e->getMessage());
        }
        if (is_resource($staged['handle'])) {
            fclose($staged['handle']);
        }

        emit([
            'phase' => 'expect-failure',
            'ok' => $productThrew,
            'productPathThrew' => $productThrew,
            'rawDiskThrew' => $rawThrew,
            'rawDiskReturned' => $rawReturned,
            'note' => 'raw disk returns false without raising (throw=false); the product adapter converts that to an exception',
            'error' => mb_substr($error, 0, 400),
        ]);
        exit(0);
    }

    // After the provider returns: the interrupted key must not linger as a
    // half-written object that later reads would silently trust.
    if ($phase === 'integrity') {
        $key = PREFIX.'/interrupted.bin';
        $lingering = $disk->exists($key);
        if ($lingering) {
            $disk->delete($key);
        }
        $remaining = $disk->files(PREFIX);
        emit([
            'phase' => 'integrity',
            'ok' => ! $lingering && count($remaining) === 0,
            'partialObjectPresent' => $lingering,
            'remainingObjects' => count($remaining),
        ]);
        exit(0);
    }

    emit(['phase' => $phase, 'ok' => false, 'error' => 'unknown phase']);
    exit(2);
} catch (Throwable $e) {
    emit(['phase' => $phase, 'ok' => false, 'error' => mb_substr(redact($e->getMessage()), 0, 400)]);
    exit(1);
}
