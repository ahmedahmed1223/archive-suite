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
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

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

/** 1 MiB of non-compressible-ish deterministic data; flat bytes would hide transfer bugs. */
function makePayload(int $sizeMb): string
{
    $chunk = '';
    for ($i = 0; $i < 32768; $i++) {
        $chunk .= hash('sha256', "v1-x01-block-{$i}", true); // 32 bytes each => 1 MiB
    }

    return str_repeat($chunk, max(1, $sizeMb));
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
        $body = makePayload($sizeMb);
        $expected = hash('sha256', $body);
        $started = microtime(true);
        $disk->put($key, $body);
        $uploadSeconds = microtime(true) - $started;
        $readBack = $disk->get($key);
        $actual = hash('sha256', (string) $readBack);
        $size = $disk->size($key);
        $disk->delete($key);
        emit([
            'phase' => 'large',
            'ok' => $expected === $actual && $size === strlen($body),
            'sizeBytes' => $size,
            'requestedMb' => $sizeMb,
            'sha256Match' => $expected === $actual,
            'uploadSeconds' => round($uploadSeconds, 2),
        ]);
        exit(0);
    }

    // Run while the provider is paused: a clean, loud failure is the pass condition.
    if ($phase === 'expect-failure') {
        $key = PREFIX.'/interrupted.bin';
        $threw = false;
        $error = '';
        try {
            $disk->put($key, makePayload(max(1, $sizeMb)));
        } catch (Throwable $e) {
            $threw = true;
            $error = redact($e->getMessage());
        }
        emit([
            'phase' => 'expect-failure',
            'ok' => $threw,
            'threw' => $threw,
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
