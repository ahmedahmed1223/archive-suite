<?php

namespace App\Services\Media;

use App\Exceptions\JobCanceledException;
use App\Models\MediaJob;

class RealMediaProcessor implements MediaProcessor
{
    private readonly MediaPathGuard $pathGuard;

    private readonly CudaCapabilityChecker $cudaCapability;

    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly WhisperTranscriber $transcriber,
        private readonly string $ffmpegPath = 'ffmpeg',
        private readonly string $ffprobePath = 'ffprobe',
        private readonly array $watermark = [],
        private readonly ?OcrClient $ocrClient = null,
        private readonly ?AudioPreprocessor $audioPreprocessor = null,
        ?MediaPathGuard $pathGuard = null,
        private readonly ?MediaJobProgressBroadcaster $progress = null,
        ?CudaCapabilityChecker $cudaCapability = null,
    ) {
        $this->pathGuard = $pathGuard ?? new MediaPathGuard;
        $this->cudaCapability = $cudaCapability ?? new CudaCapabilityChecker($runner);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function updateProgress(MediaJob $job, array $attributes): void
    {
        if ($this->progress) {
            $this->progress->update($job, $attributes);

            return;
        }

        $job->update($attributes);
    }

    /**
     * Process a media job using ffmpeg command-line tools.
     *
     * @return array<int, array<string, mixed>>
     */
    public function process(MediaJob $job): array
    {
        $this->guardNotCanceled($job);

        return match ($job->operation) {
            'thumbnail' => $this->processThumbnail($job),
            'transcode' => $this->processTranscode($job),
            'transcription' => $this->processTranscription($job),
            'ocr' => $this->processOcr($job),
            'montage_export' => $this->processMontageExport($job),
            'derivative' => $this->processDerivative($job),
            default => [],
        };
    }

    /**
     * Cached, version-pinned derivative generation (V3-MEDIA-006): a
     * thumbnail, waveform image, or lightweight preview (proxy) copy. The
     * MediaDerivative row identified by options.derivativeId already
     * carries the cache-key identity (source fingerprint + version +
     * settings hash); this only ever produces the file. Promotion of that
     * file to its final path is atomic (stage-then-rename) so a failed
     * attempt can never leave a corrupt file at the location a client might
     * already be reading from -- see stageDerivativeOutput()/
     * promoteStagedOutput().
     *
     * @return array<int, array<string, mixed>>
     */
    private function processDerivative(MediaJob $job): array
    {
        $type = $job->options['derivativeType'] ?? null;
        $settings = is_array($job->options['settings'] ?? null) ? $job->options['settings'] : [];

        return match ($type) {
            'thumbnail' => $this->processDerivativeThumbnail($job, $settings),
            'waveform' => $this->processDerivativeWaveform($job, $settings),
            'proxy' => $this->processDerivativeProxy($job, $settings),
            default => throw new \RuntimeException("Unknown derivative type: {$type}"),
        };
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<int, array<string, mixed>>
     */
    private function processDerivativeThumbnail(MediaJob $job, array $settings): array
    {
        $sourcePath = $this->pathGuard->resolveInput($job->source_path, 'sourcePath');
        $atSec = (float) ($settings['atSec'] ?? 0);
        $outputKey = "{$job->record_id}/derivatives/{$this->derivativeId($job)}.jpg";
        [$outputPath, $tempPath] = $this->stageDerivativeOutput($outputKey, 'thumbnail derivative output');

        $command = [$this->ffmpegPath, '-y', '-i', $sourcePath, '-ss', (string) $atSec];

        $width = (int) ($settings['width'] ?? 0);
        if ($width > 0) {
            $command[] = '-vf';
            $command[] = "scale={$width}:-2";
        }

        array_push($command, '-vframes', '1', '-q:v', '2', $tempPath);

        $result = $this->runner->run($command, null, fn (): bool => $this->isCanceled($job));
        $this->throwIfCanceled($result);
        if ($result['exitCode'] !== 0) {
            $this->discardStagedOutput($tempPath);
            throw new \RuntimeException("ffmpeg derivative thumbnail failed: {$result['stderr']}");
        }
        $this->promoteStagedOutput($tempPath, $outputPath);

        return [
            [
                'kind' => 'derivative_thumbnail',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<int, array<string, mixed>>
     */
    private function processDerivativeWaveform(MediaJob $job, array $settings): array
    {
        $sourcePath = $this->pathGuard->resolveInput($job->source_path, 'sourcePath');
        $width = max(64, min((int) ($settings['width'] ?? 1280), 4096));
        $height = max(32, min((int) ($settings['height'] ?? 240), 2048));
        $color = $this->safeWaveformColor($settings['color'] ?? '3B82F6');
        $outputKey = "{$job->record_id}/derivatives/{$this->derivativeId($job)}.png";
        [$outputPath, $tempPath] = $this->stageDerivativeOutput($outputKey, 'waveform derivative output');

        $command = [
            $this->ffmpegPath,
            '-y',
            '-i', $sourcePath,
            '-filter_complex', "showwavespic=s={$width}x{$height}:colors=#{$color}",
            '-frames:v', '1',
            $tempPath,
        ];

        $result = $this->runner->run($command, null, fn (): bool => $this->isCanceled($job));
        $this->throwIfCanceled($result);
        if ($result['exitCode'] !== 0) {
            $this->discardStagedOutput($tempPath);
            throw new \RuntimeException("ffmpeg derivative waveform failed: {$result['stderr']}");
        }
        $this->promoteStagedOutput($tempPath, $outputPath);

        return [
            [
                'kind' => 'derivative_waveform',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    /**
     * Lightweight preview copy. GPU acceleration (h264_nvenc) is only ever
     * used after CudaCapabilityChecker::assertAvailable() confirms a
     * healthy NVIDIA runtime -- the exact fail-closed gate
     * WhisperTranscriber already uses for --device cuda. A client asking
     * for acceleration on a worker without a GPU gets a clean
     * GpuUnavailableException, never a silent CPU fallback that would let
     * the returned artifact falsely claim GPU encoding.
     *
     * @param  array<string, mixed>  $settings
     * @return array<int, array<string, mixed>>
     */
    private function processDerivativeProxy(MediaJob $job, array $settings): array
    {
        $sourcePath = $this->pathGuard->resolveInput($job->source_path, 'sourcePath');
        $maxWidth = max(64, min((int) ($settings['maxWidth'] ?? 640), 4096));
        $videoBitrateKbps = max(64, min((int) ($settings['videoBitrateKbps'] ?? 600), 8000));
        $outputKey = "{$job->record_id}/derivatives/{$this->derivativeId($job)}.mp4";
        [$outputPath, $tempPath] = $this->stageDerivativeOutput($outputKey, 'proxy derivative output');

        $encoder = 'libx264';
        if ($this->truthy($settings['accelerate'] ?? false)) {
            $this->cudaCapability->assertAvailable();
            $encoder = 'h264_nvenc';
        }

        $command = [
            $this->ffmpegPath,
            '-y',
            '-i', $sourcePath,
            // The comma inside min(...) has to be backslash-escaped: this
            // whole expression travels as a single argv element (no shell
            // involved -- ProcessRunner execs ffmpeg directly), and within
            // an ffmpeg filtergraph string an unescaped ',' is the filter
            // separator, not part of the expression. Quoting it instead
            // (scale='min(W,iw)':-2) parses but silently fails to apply --
            // confirmed by RealMediaProcessorFfmpegSmokeTest against the
            // real binary (output stayed at the source's original width).
            '-vf', "scale=min({$maxWidth}\\,iw):-2",
            '-c:v', $encoder,
            '-b:v', "{$videoBitrateKbps}k",
            '-preset', $encoder === 'h264_nvenc' ? 'p4' : 'veryfast',
            '-c:a', 'aac',
            '-b:a', '96k',
            $tempPath,
        ];

        $result = $this->runner->run($command, null, fn (): bool => $this->isCanceled($job));
        $this->throwIfCanceled($result);
        if ($result['exitCode'] !== 0) {
            $this->discardStagedOutput($tempPath);
            throw new \RuntimeException("ffmpeg derivative proxy failed: {$result['stderr']}");
        }
        $this->promoteStagedOutput($tempPath, $outputPath);

        return [
            [
                'kind' => 'derivative_proxy',
                'key' => $outputKey,
                'url' => null,
                // Honest report of what actually ran, never just an echo of
                // the client's requested settings.accelerate flag.
                'encoder' => $encoder,
            ],
        ];
    }

    private function derivativeId(MediaJob $job): string
    {
        $id = $job->options['derivativeId'] ?? null;

        return is_string($id) && trim($id) !== '' ? $id : $job->id;
    }

    /**
     * Resolves the derivative's final output path (contained under the
     * media storage root) alongside a sibling temp path in the same
     * directory. Writing ffmpeg's output to the temp path and only
     * rename()-ing it onto the final path on success means a failed or
     * killed ffmpeg run never leaves a partial/corrupt file at the path a
     * client might already be reading from (V3-MEDIA-006 acceptance:
     * "never silently serve stale" extends to "never serve a half-written
     * file" too). The temp path lives beside the final one so the rename is
     * same-filesystem and therefore atomic.
     *
     * The marker is a fixed ".tmp-" infix, not a random suffix: the final
     * output key already embeds the derivative's own id (see
     * derivativeId()), so it is already unique per cache-key row, and
     * WithoutOverlapping already stops two attempts of the *same* MediaJob
     * running concurrently -- there is nothing left for a random name to
     * protect against, and a fixed one keeps a retried attempt's leftover
     * temp file self-cleaning (next attempt's ffmpeg -y overwrites it).
     *
     * It is an infix (".tmp-{basename}"), not a plain ".tmp" suffix: ffmpeg
     * picks its output container/image format from the filename extension
     * when -f isn't given, and a trailing ".tmp" hides the real extension
     * from it -- confirmed by RealMediaProcessorFfmpegSmokeTest against the
     * real binary ("Unable to choose an output format for
     * ....png.tmp"). Keeping the real extension last avoids depending on
     * every derivative command remembering to pass -f explicitly.
     *
     * @return array{0: string, 1: string} [outputPath, tempPath]
     */
    private function stageDerivativeOutput(string $outputKey, string $label): array
    {
        $outputPath = $this->pathGuard->resolveOutput($outputKey, $label);
        $tempPath = dirname($outputPath).DIRECTORY_SEPARATOR.'.tmp-'.basename($outputPath);

        return [$outputPath, $tempPath];
    }

    private function promoteStagedOutput(string $tempPath, string $outputPath): void
    {
        if (! @rename($tempPath, $outputPath)) {
            @unlink($tempPath);
            throw new \RuntimeException('Failed to promote generated derivative to its final location.');
        }
    }

    private function discardStagedOutput(string $tempPath): void
    {
        @unlink($tempPath);
    }

    private function safeWaveformColor(mixed $color): string
    {
        $color = is_string($color) ? strtoupper((string) preg_replace('/[^0-9A-Fa-f]/', '', $color)) : '';

        return preg_match('/^[0-9A-F]{6}$/', $color) === 1 ? $color : '3B82F6';
    }

    private function processThumbnail(MediaJob $job): array
    {
        $sourcePath = $this->pathGuard->resolveInput($job->source_path, 'sourcePath');
        $atSec = $job->options['atSec'] ?? 0;
        $outputKey = "{$job->record_id}/thumb.jpg";
        $outputPath = $this->pathGuard->resolveOutput($outputKey, 'thumbnail output');

        $command = [
            $this->ffmpegPath,
            '-y', // V3-PERF-005: overwrite unconditionally so a retried attempt (fixed output key) is idempotent instead of failing on a leftover partial file from the prior attempt.
            '-i', $sourcePath,
            '-ss', (string) $atSec,
            '-vframes', '1',
            '-q:v', '2',
            $outputPath,
        ];

        $result = $this->runner->run($command, null, fn (): bool => $this->isCanceled($job));
        $this->throwIfCanceled($result);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("ffmpeg thumbnail failed: {$result['stderr']}");
        }

        return [
            [
                'kind' => 'thumbnail',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    private function processTranscode(MediaJob $job): array
    {
        $sourcePath = $this->pathGuard->resolveInput($job->source_path, 'sourcePath');
        $outputKey = "{$job->record_id}/transcoded.mp4";
        $outputPath = $this->pathGuard->resolveOutput($outputKey, 'transcode output');
        $watermark = $this->watermarkOptions($job);

        $command = [
            $this->ffmpegPath,
            '-y', // V3-PERF-005: idempotent overwrite on retry, see processThumbnail().
            '-i', $sourcePath,
        ];

        if ($watermark !== null) {
            $command[] = '-i';
            $command[] = $watermark['path'];
            $command[] = '-filter_complex';
            $command[] = $this->buildWatermarkFilter($watermark);
            $command[] = '-map';
            $command[] = '[v]';
            $command[] = '-map';
            $command[] = '0:a?';
        }

        array_push(
            $command,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-c:a', 'aac',
            '-b:a', '128k',
            $outputPath,
        );

        $result = $this->runner->run($command, null, fn (): bool => $this->isCanceled($job));
        $this->throwIfCanceled($result);
        if ($result['exitCode'] !== 0) {
            throw new \RuntimeException("ffmpeg transcode failed: {$result['stderr']}");
        }

        return [
            [
                'kind' => 'video',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    private function processTranscription(MediaJob $job): array
    {
        $preprocessor = $this->audioPreprocessor ?? new AudioPreprocessor($this->runner, $this->ffmpegPath, pathGuard: $this->pathGuard);
        $sourcePath = $this->pathGuard->resolveInput($job->source_path, 'sourcePath');
        $outputFormats = $job->options['outputFormats'] ?? ['srt', 'vtt', 'ttml'];

        $this->updateProgress($job, [
            'progress_stage' => 'preprocessing',
            'progress_percent' => 5,
        ]);

        // Extract audio to normalized 16kHz mono WAV
        $audioPath = $preprocessor->extractAudio($sourcePath, $job->record_id);

        // Plan segments (chunking for long audio)
        $segments = $preprocessor->planSegments($audioPath);
        $totalSegments = count($segments);

        $this->updateProgress($job, [
            'progress_stage' => 'preprocessing_complete',
            'progress_percent' => 10,
            'options' => array_merge($job->options, [
                'segments' => $segments,
                'totalSegments' => $totalSegments,
            ]),
        ]);

        if ($totalSegments === 1) {
            // Single segment: transcribe audio directly
            $this->updateProgress($job, [
                'progress_stage' => 'transcribing',
                'progress_percent' => 15,
            ]);

            return $this->transcriber->transcribe($audioPath, $job->record_id, [
                'outputFormats' => $outputFormats,
            ]);
        }

        // Multiple segments: transcribe each, merge results
        $allArtifacts = [];

        foreach ($segments as $index => $segment) {
            // Real mid-job cancel checkpoint: a long transcription is the
            // only operation here with a natural pause point between
            // steps. Single-shot ffmpeg/OCR calls have no such checkpoint —
            // killing an in-flight subprocess is out of scope (V1-113).
            $this->guardNotCanceled($job);

            $segmentPercent = 15 + (int) (($index / $totalSegments) * 70);
            $this->updateProgress($job, [
                'progress_stage' => "transcribing_segment_{$index}_{$totalSegments}",
                'progress_percent' => $segmentPercent,
            ]);

            // Extract segment
            $segmentPath = $preprocessor->extractSegment(
                $audioPath,
                $job->record_id,
                $index,
                $segment['startSec'],
                $segment['endSec']
            );

            // Transcribe segment
            // Each segment needs an isolated output directory. Whisper otherwise writes every
            // transcript to the same fixed key and the later segment overwrites the earlier one.
            // resolveOutputDir contains + creates it (record_id is client input).
            $segmentRecordId = "{$job->record_id}/segments/{$index}";
            $this->pathGuard->resolveOutputDir($segmentRecordId, 'segment transcript directory');
            $segmentArtifacts = $this->transcriber->transcribe($segmentPath, $segmentRecordId, [
                'outputFormats' => $outputFormats,
            ]);

            // Store segment artifacts keyed by index for merging
            if (! isset($allArtifacts['by_format'])) {
                $allArtifacts['by_format'] = [];
                foreach ($outputFormats as $fmt) {
                    $allArtifacts['by_format'][$fmt] = [];
                }
            }

            foreach ($segmentArtifacts as $artifact) {
                preg_match('/transcript_(\w+)/', $artifact['kind'], $m);
                if ($m) {
                    $format = $m[1];
                    $allArtifacts['by_format'][$format][] = [
                        'artifact' => $artifact,
                        'offsetSec' => (float) $segment['startSec'],
                    ];
                }
            }
        }

        $this->updateProgress($job, [
            'progress_stage' => 'merging',
            'progress_percent' => 90,
        ]);

        // Merge segment artifacts into final outputs
        $mergedArtifacts = $this->mergeSegmentArtifacts(
            $allArtifacts['by_format'] ?? [],
            $job->record_id,
            $outputFormats
        );

        return $mergedArtifacts;
    }

    /**
     * Merge per-segment transcript artifacts into unified documents with timeline timestamps.
     *
     * @param  array<string, array<int, array{artifact: array{kind: string, key: string, url: null}, offsetSec: float}>>  $byFormat
     * @param  array<int, string>  $outputFormats
     * @return array<int, array{kind: string, key: string, url: null}>
     */
    private function mergeSegmentArtifacts(array $byFormat, string $recordId, array $outputFormats): array
    {
        $merged = [];

        foreach ($outputFormats as $format) {
            if (! isset($byFormat[$format]) || empty($byFormat[$format])) {
                continue;
            }

            $key = "{$recordId}/transcript.{$format}";
            $chunks = [];
            $srtCueIndex = 0;

            foreach ($byFormat[$format] as $segmentArtifact) {
                $artifact = $segmentArtifact['artifact'];
                // These keys were written moments ago by our own transcriber run
                // (not attacker input); absolutePath() still enforces containment.
                $segmentArtifactPath = $this->pathGuard->absolutePath($artifact['key'], 'segment transcript');
                if (is_file($segmentArtifactPath)) {
                    $content = file_get_contents($segmentArtifactPath);
                    if ($content === false) {
                        continue;
                    }

                    $content = $this->shiftTranscriptTimestamps(
                        $content,
                        $format,
                        $segmentArtifact['offsetSec']
                    );

                    if ($format === 'srt') {
                        $content = $this->renumberSrtCueIdentifiers($content, $srtCueIndex);
                    }

                    if ($format === 'vtt') {
                        $content = $this->withoutVttHeader($content);
                    }

                    $chunks[] = trim($content);
                }
            }

            $content = match ($format) {
                'vtt' => "WEBVTT\n\n".implode("\n\n", array_filter($chunks)),
                'ttml' => $this->mergeTtmlChunks($chunks),
                default => implode("\n\n", array_filter($chunks)),
            };

            if (trim($content) !== '') {
                $outputPath = $this->pathGuard->resolveOutput($key, 'merged transcript output');
                file_put_contents($outputPath, trim($content));
                $merged[] = [
                    'kind' => "transcript_{$format}",
                    'key' => $key,
                    'url' => null,
                ];
            }
        }

        return $merged;
    }

    private function shiftTranscriptTimestamps(string $content, string $format, float $offsetSec): string
    {
        if ($offsetSec === 0.0) {
            return $content;
        }

        if ($format === 'ttml') {
            return preg_replace_callback(
                '/\\b(begin|end)=(["\'])([^"\']+)\\2/',
                fn (array $match): string => "{$match[1]}={$match[2]}".$this->shiftTimestamp($match[3], $offsetSec).$match[2],
                $content
            ) ?? $content;
        }

        return preg_replace_callback(
            '/(?:(?:\\d{2,}):)?\\d{2}:\\d{2}[,.]\\d{3}\\s*-->\\s*(?:(?:\\d{2,}):)?\\d{2}:\\d{2}[,.]\\d{3}/',
            function (array $match) use ($offsetSec): string {
                [$start, $end] = preg_split('/\\s*-->\\s*/', $match[0]) ?: [];

                return $this->shiftTimestamp($start, $offsetSec)
                    .' --> '
                    .$this->shiftTimestamp($end, $offsetSec);
            },
            $content
        ) ?? $content;
    }

    private function shiftTimestamp(string $timestamp, float $offsetSec): string
    {
        if (! preg_match('/^(?:(\\d{2,}):)?(\\d{2}):(\\d{2})([,.])(\\d{3})$/', trim($timestamp), $match)) {
            return $timestamp;
        }

        $hours = isset($match[1]) && $match[1] !== '' ? (int) $match[1] : 0;
        $milliseconds = (int) round((($hours * 3600) + ((int) $match[2] * 60) + (int) $match[3] + $offsetSec) * 1000)
            + (int) $match[5];
        $hours = intdiv($milliseconds, 3_600_000);
        $milliseconds %= 3_600_000;
        $minutes = intdiv($milliseconds, 60_000);
        $milliseconds %= 60_000;
        $seconds = intdiv($milliseconds, 1000);
        $milliseconds %= 1000;

        return sprintf('%02d:%02d:%02d%s%03d', $hours, $minutes, $seconds, $match[4], $milliseconds);
    }

    private function renumberSrtCueIdentifiers(string $content, int &$nextCueIndex): string
    {
        return preg_replace_callback(
            '/^\\d+\\R(?=\\d{2}:\\d{2}:\\d{2},\\d{3}\\s*-->)/m',
            fn (): string => (++$nextCueIndex)."\n",
            $content
        ) ?? $content;
    }

    private function withoutVttHeader(string $content): string
    {
        return preg_replace('/^(?:\\xEF\\xBB\\xBF)?WEBVTT[^\\r\\n]*(?:\\r?\\n){0,2}/', '', $content) ?? $content;
    }

    /**
     * @param  array<int, string>  $chunks
     */
    private function mergeTtmlChunks(array $chunks): string
    {
        $paragraphs = [];

        foreach ($chunks as $chunk) {
            if (preg_match_all('/<p\\b[^>]*>.*?<\\/p>/is', $chunk, $matches)) {
                array_push($paragraphs, ...$matches[0]);
            }
        }

        if ($paragraphs === []) {
            return '';
        }

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            ."<tt xmlns=\"http://www.w3.org/ns/ttml\">\n  <body>\n    <div>\n      "
            .implode("\n      ", $paragraphs)
            ."\n    </div>\n  </body>\n</tt>";
    }

    /**
     * Concatenate ordered montage clips into a single MP4 via ffmpeg's concat
     * demuxer. Expects `options.clips` as an ordered list of
     * {path, inSec, outSec}. Runs only inside the queued job — never
     * synchronously in the request cycle.
     *
     * @return array<int, array<string, mixed>>
     */
    private function processMontageExport(MediaJob $job): array
    {
        $clips = $job->options['clips'] ?? [];
        if (! is_array($clips) || $clips === []) {
            throw new \RuntimeException('Montage export requires at least one clip.');
        }

        $outputKey = "{$job->record_id}/montage.mp4";
        $outputPath = $this->pathGuard->resolveOutput($outputKey, 'montage output');
        $segments = [];

        foreach ($clips as $index => $clip) {
            $this->updateProgress($job, [
                'progress_stage' => "montage_segment_{$index}_".count($clips),
                'progress_percent' => 10 + (int) (($index / max(1, count($clips))) * 75),
            ]);
            $path = is_array($clip) ? ($clip['path'] ?? null) : null;
            if (! is_string($path) || trim($path) === '') {
                throw new \RuntimeException('Montage export clip is missing a source path.');
            }

            $clipPath = $this->pathGuard->resolveInput($path, "montage clip {$index} path");

            $inSec = (float) ($clip['inSec'] ?? 0);
            $outSec = (float) ($clip['outSec'] ?? 0);
            $segmentKey = "{$job->record_id}/montage-segment-{$index}.mp4";
            $segmentPath = $this->pathGuard->resolveOutput($segmentKey, 'montage segment output');

            $trimCommand = [
                $this->ffmpegPath,
                '-y', // V3-PERF-005: idempotent overwrite on retry, see processThumbnail().
                '-i', $clipPath,
                '-ss', (string) $inSec,
            ];

            if ($outSec > $inSec) {
                $trimCommand[] = '-t';
                $trimCommand[] = (string) ($outSec - $inSec);
            }

            array_push($trimCommand, '-c', 'copy', $segmentPath);

            $trimResult = $this->runner->run($trimCommand, null, fn (): bool => $this->isCanceled($job));
            $this->throwIfCanceled($trimResult);
            if ($trimResult['exitCode'] !== 0) {
                throw new \RuntimeException("ffmpeg montage segment failed: {$trimResult['stderr']}");
            }

            $segments[] = $segmentPath;
        }

        $listFile = tempnam(sys_get_temp_dir(), 'montage-concat-');
        file_put_contents($listFile, implode("\n", array_map(
            fn (string $segment): string => "file '{$segment}'",
            $segments,
        )));

        $concatCommand = [
            $this->ffmpegPath,
            '-y', // V3-PERF-005: idempotent overwrite on retry, see processThumbnail().
            '-f', 'concat',
            '-safe', '0',
            '-i', $listFile,
            '-c', 'copy',
            $outputPath,
        ];

        $concatResult = $this->runner->run($concatCommand, null, fn (): bool => $this->isCanceled($job));
        @unlink($listFile);
        $this->throwIfCanceled($concatResult);

        if ($concatResult['exitCode'] !== 0) {
            throw new \RuntimeException("ffmpeg montage concat failed: {$concatResult['stderr']}");
        }

        $this->updateProgress($job, [
            'progress_stage' => 'montage_complete',
            'progress_percent' => 95,
        ]);

        return [
            [
                'kind' => 'montage_mp4',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    private function processOcr(MediaJob $job): array
    {
        $client = $this->ocrClient ?? new OcrClient;
        $sourcePath = $this->pathGuard->resolveInput($job->source_path, 'sourcePath');
        $text = $client->extractText($sourcePath);

        $outputKey = "{$job->record_id}/ocr.txt";
        $outputPath = $this->pathGuard->resolveOutput($outputKey, 'OCR output');
        file_put_contents($outputPath, $text);

        return [
            [
                'kind' => 'ocr_text',
                'key' => $outputKey,
                'url' => null,
            ],
        ];
    }

    /**
     * @return array{path: string, position: string, opacity: float, margin: int}|null
     */
    private function watermarkOptions(MediaJob $job): ?array
    {
        $jobWatermark = $job->options['watermark'] ?? null;

        if (is_array($jobWatermark) && array_key_exists('enabled', $jobWatermark) && ! $this->truthy($jobWatermark['enabled'])) {
            return null;
        }

        $candidate = is_array($jobWatermark)
            ? array_merge($this->watermark, $jobWatermark)
            : $this->watermark;

        if (! is_array($candidate) || (! $this->truthy($candidate['enabled'] ?? false) && ! is_array($jobWatermark))) {
            return null;
        }

        $path = $candidate['path'] ?? null;
        if (! is_string($path) || trim($path) === '') {
            return null;
        }
        $path = trim($path);

        // Only contain the path when the *client* supplied it via job options.
        // config('media.watermark.path') is trusted admin config and may
        // legitimately live outside the archive-files storage root.
        $clientSuppliedPath = is_array($jobWatermark) && is_string($jobWatermark['path'] ?? null) && trim((string) $jobWatermark['path']) !== '';
        if ($clientSuppliedPath) {
            $path = $this->pathGuard->resolveInput($path, 'watermark path');
        }

        return [
            'path' => $path,
            'position' => $this->normalizeWatermarkPosition($candidate['position'] ?? 'bottom-right'),
            'opacity' => $this->clampFloat($candidate['opacity'] ?? 0.85, 0.0, 1.0),
            'margin' => max(0, min((int) ($candidate['margin'] ?? 24), 512)),
        ];
    }

    /**
     * @param  array{path: string, position: string, opacity: float, margin: int}  $watermark
     */
    private function buildWatermarkFilter(array $watermark): string
    {
        [$x, $y] = match ($watermark['position']) {
            'top-left' => [(string) $watermark['margin'], (string) $watermark['margin']],
            'top-right' => ["W-w-{$watermark['margin']}", (string) $watermark['margin']],
            'bottom-left' => [(string) $watermark['margin'], "H-h-{$watermark['margin']}"],
            'center' => ['(W-w)/2', '(H-h)/2'],
            default => ["W-w-{$watermark['margin']}", "H-h-{$watermark['margin']}"],
        };

        $opacity = rtrim(rtrim(sprintf('%.3F', $watermark['opacity']), '0'), '.');

        return "[1:v]format=rgba,colorchannelmixer=aa={$opacity}[wm];[0:v][wm]overlay=x={$x}:y={$y}[v]";
    }

    private function normalizeWatermarkPosition(mixed $position): string
    {
        if (! is_string($position)) {
            return 'bottom-right';
        }

        return match ($position) {
            'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center' => $position,
            default => 'bottom-right',
        };
    }

    private function clampFloat(mixed $value, float $min, float $max): float
    {
        return max($min, min((float) $value, $max));
    }

    /**
     * Re-reads the job's persisted status. No-ops (returns false) for
     * unsaved/in-memory jobs (unit tests that construct a MediaJob without
     * persisting it) since there is nothing in the database to have been
     * canceled.
     *
     * Used two ways: as a one-shot guard between steps (guardNotCanceled(),
     * below) and as the polling callback SymfonyProcessRunner checks while a
     * single ffmpeg subprocess is still running, so cancellation can kill
     * that subprocess instead of only taking effect at the next checkpoint
     * (V3-PERF-005).
     */
    private function isCanceled(MediaJob $job): bool
    {
        if (! $job->exists) {
            return false;
        }

        return MediaJob::query()->whereKey($job->getKey())->value('status') === 'canceled';
    }

    /**
     * Stops processing if the job was canceled via the cancel API.
     */
    private function guardNotCanceled(MediaJob $job): void
    {
        if ($this->isCanceled($job)) {
            throw new JobCanceledException('Media job was canceled before completion.');
        }
    }

    /**
     * @param  array{exitCode: int, stdout: string, stderr: string, canceled?: bool}  $result
     */
    private function throwIfCanceled(array $result): void
    {
        if (($result['canceled'] ?? false) === true) {
            throw new JobCanceledException('Media job was canceled during processing.');
        }
    }

    private function truthy(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_string($value)) {
            return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
        }

        return (bool) $value;
    }
}
