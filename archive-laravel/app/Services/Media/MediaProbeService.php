<?php

namespace App\Services\Media;

use JsonException;
use RuntimeException;

class MediaProbeService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly MediaPathGuard $pathGuard,
        private readonly string $ffprobePath = 'ffprobe',
    ) {}

    /**
     * Inspect a media file and return a stable, path-free representation of
     * ffprobe's output suitable for storing in a media job result.
     *
     * @return array<string, mixed>
     */
    public function inspect(string $sourcePath, ?callable $shouldCancel = null): array
    {
        $absoluteSource = $this->pathGuard->resolveInput($sourcePath, 'sourcePath');
        $result = $this->runner->run([
            $this->ffprobePath,
            '-v', 'error',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            '--',
            $absoluteSource,
        ], null, $shouldCancel);

        if (($result['canceled'] ?? false) === true) {
            throw new RuntimeException('Media probe was canceled.');
        }

        if ($result['exitCode'] !== 0) {
            throw new RuntimeException('ffprobe failed: '.trim($result['stderr']));
        }

        try {
            $payload = json_decode($result['stdout'], true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('ffprobe returned invalid JSON.', previous: $exception);
        }

        if (! is_array($payload)) {
            throw new RuntimeException('ffprobe returned invalid JSON.');
        }

        $format = is_array($payload['format'] ?? null) ? $payload['format'] : [];
        $streams = is_array($payload['streams'] ?? null) ? $payload['streams'] : [];

        return [
            'formatNames' => array_values(array_filter(explode(',', (string) ($format['format_name'] ?? '')))),
            'formatLongName' => $this->nullableString($format['format_long_name'] ?? null),
            'durationSeconds' => $this->nullableFloat($format['duration'] ?? null),
            'startTimeSeconds' => $this->nullableFloat($format['start_time'] ?? null),
            'sizeBytes' => $this->nullableInt($format['size'] ?? null),
            'bitRate' => $this->nullableInt($format['bit_rate'] ?? null),
            'tags' => $this->stringMap($format['tags'] ?? null),
            'streams' => array_values(array_map(fn (array $stream): array => $this->normalizeStream($stream), array_filter($streams, 'is_array'))),
        ];
    }

    /** @return array<string, mixed> */
    private function normalizeStream(array $stream): array
    {
        $tags = is_array($stream['tags'] ?? null) ? $stream['tags'] : [];
        $disposition = is_array($stream['disposition'] ?? null) ? $stream['disposition'] : [];
        $knownTypes = ['video', 'audio', 'subtitle', 'data', 'attachment'];
        $type = (string) ($stream['codec_type'] ?? 'unknown');

        return [
            'index' => (int) ($stream['index'] ?? 0),
            'type' => in_array($type, $knownTypes, true) ? $type : 'unknown',
            'codec' => $this->nullableString($stream['codec_name'] ?? null) ?? 'unknown',
            'codecLongName' => $this->nullableString($stream['codec_long_name'] ?? null),
            'durationSeconds' => $this->nullableFloat($stream['duration'] ?? null),
            'bitRate' => $this->nullableInt($stream['bit_rate'] ?? null),
            'width' => $this->nullableInt($stream['width'] ?? null),
            'height' => $this->nullableInt($stream['height'] ?? null),
            'frameRate' => $this->rational($stream['avg_frame_rate'] ?? null),
            'pixelAspectRatio' => $this->nullableString($stream['sample_aspect_ratio'] ?? null),
            'channels' => $this->nullableInt($stream['channels'] ?? null),
            'channelLayout' => $this->nullableString($stream['channel_layout'] ?? null),
            'sampleRate' => $this->nullableInt($stream['sample_rate'] ?? null),
            'language' => $this->nullableString($tags['language'] ?? null),
            'default' => (bool) ($disposition['default'] ?? false),
            'forced' => (bool) ($disposition['forced'] ?? false),
        ];
    }

    /** @return array{numerator: int, denominator: int}|null */
    private function rational(mixed $value): ?array
    {
        if (! is_string($value) || preg_match('/^(\d+)\/(\d+)$/', $value, $parts) !== 1 || (int) $parts[2] < 1) {
            return null;
        }

        return ['numerator' => (int) $parts[1], 'denominator' => (int) $parts[2]];
    }

    /** @return array<string, string> */
    private function stringMap(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_filter($value, 'is_string');
    }

    private function nullableString(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    private function nullableFloat(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function nullableInt(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }
}
