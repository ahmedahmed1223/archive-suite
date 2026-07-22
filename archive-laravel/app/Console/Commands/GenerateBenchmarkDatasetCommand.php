<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * V1-307A: deterministic synthetic dataset for perf benchmarking (V1-307B..D,
 * V1-812). Records land in the ordinary `storage_rows` table but under a
 * dedicated `store` value (`self::STORE`) so they never mix with real
 * archive content and can be wiped with one `DELETE ... WHERE store = ?`.
 * Every title/description is also prefixed so nobody mistakes a synthetic
 * row for real archive content in the UI.
 *
 * Determinism: given the same --seed, --records, --files and --files-total-size,
 * two runs produce byte-identical record data and file content/checksums —
 * everything derives from `$index` and a seeded Faker, never from time()/uniqid().
 */
class GenerateBenchmarkDatasetCommand extends Command
{
    public const STORE = 'benchmark-synthetic';

    private const TITLE_PREFIX = '[BENCHMARK-SYNTHETIC]';

    private const TYPES = [
        ['type' => 'video', 'label' => 'فيديو'],
        ['type' => 'image', 'label' => 'صورة'],
        ['type' => 'document', 'label' => 'وثيقة'],
        ['type' => 'audio', 'label' => 'تسجيل صوتي'],
        ['type' => 'map', 'label' => 'خريطة'],
    ];

    private const SECTIONS = ['الأخبار', 'الرياضة', 'الثقافة', 'الوثائقية', 'الاقتصاد', 'المحليات'];

    private const CLASSIFICATIONS = ['عام', 'أرشيف تاريخي', 'حصري', 'مقيّد', 'قيد المراجعة'];

    /** Fixed namespace for deterministic attachment UUIDs (Str::uuid5). */
    private const UUID_NAMESPACE = '6f9b1e2a-2f0a-4d8a-9d1b-7e0c7c5e6a10';

    protected $signature = 'archive:generate-benchmark-dataset
        {--seed=42 : Deterministic seed; same seed+counts always reproduces the same dataset}
        {--records=100000 : Number of synthetic Arabic archive records to generate}
        {--files=10000 : Number of synthetic files to generate}
        {--files-total-size=1073741824 : Total bytes distributed across the generated files (default 1GB)}
        {--disk= : Filesystem disk to write synthetic files to (defaults to config(filesystems.default))}
        {--chunk=500 : Batch size for DB inserts}
        {--json : Print a single JSON summary instead of narration}';

    protected $description = 'Generate a deterministic, purely synthetic benchmark dataset (Arabic records + files) for V1-307B..D/V1-812 perf tests';

    public function handle(): int
    {
        $seed = (int) $this->option('seed');
        $recordCount = max(0, (int) $this->option('records'));
        $fileCount = max(0, (int) $this->option('files'));
        $totalSize = max(0, (int) $this->option('files-total-size'));
        $disk = (string) ($this->option('disk') ?: config('filesystems.default'));
        $chunkSize = max(1, (int) $this->option('chunk'));
        $json = (bool) $this->option('json');

        $recordUids = $this->generateRecords($seed, $recordCount, $chunkSize);
        $fileSummary = $this->generateFiles($seed, $fileCount, $totalSize, $disk, $recordUids, $chunkSize);

        $message = "Generated {$recordCount} synthetic record(s) in store '".self::STORE."' and {$fileSummary['count']} file(s) totalling {$fileSummary['bytes']} byte(s) on disk '{$disk}'.";

        if ($json) {
            $this->line(json_encode([
                'ok' => true,
                'seed' => $seed,
                'store' => self::STORE,
                'records' => $recordCount,
                'files' => $fileSummary['count'],
                'filesBytes' => $fileSummary['bytes'],
                'disk' => $disk,
                'message' => $message,
            ], JSON_THROW_ON_ERROR));
        } else {
            $this->info($message);
        }

        return 0;
    }

    /**
     * @return list<string> generated record uids, for round-robin file attachment
     */
    private function generateRecords(int $seed, int $count, int $chunkSize): array
    {
        if ($count === 0) {
            return [];
        }

        $faker = \Faker\Factory::create('ar_SA');
        $faker->seed($seed);

        $now = now();
        $uids = [];
        $batch = [];

        for ($index = 0; $index < $count; $index++) {
            $uid = sprintf('bench-%d-%06d', $seed, $index);
            $uids[] = $uid;

            $type = self::TYPES[$index % count(self::TYPES)];
            $section = self::SECTIONS[$index % count(self::SECTIONS)];
            $classification = self::CLASSIFICATIONS[$index % count(self::CLASSIFICATIONS)];
            $created = $now->copy()->subMinutes($index);

            $data = [
                'id' => $uid,
                'title' => self::TITLE_PREFIX.' '.$faker->sentence(6),
                'description' => $faker->paragraph(3),
                'type' => $type['type'],
                'subtype' => null,
                'tags' => [$section, $classification, ...$faker->words(3)],
                'section' => $section,
                'classification' => $classification,
                'metadata' => [
                    'typeLabel' => $type['label'],
                    'synthetic' => true,
                    'source' => 'GenerateBenchmarkDatasetCommand',
                    'seed' => $seed,
                ],
                'createdAt' => $created->toIso8601String(),
                'updatedAt' => $created->toIso8601String(),
            ];

            $batch[] = [
                'store' => self::STORE,
                'uid' => $uid,
                'data' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'sync_version' => 1,
                'last_modified_by' => json_encode(['source' => 'GenerateBenchmarkDatasetCommand'], JSON_UNESCAPED_UNICODE),
                'created_at' => $created,
                'updated_at' => $created,
            ];

            if (count($batch) >= $chunkSize) {
                DB::table('storage_rows')->upsert($batch, ['store', 'uid'], ['data', 'sync_version', 'last_modified_by', 'updated_at']);
                $batch = [];
            }
        }

        if ($batch !== []) {
            DB::table('storage_rows')->upsert($batch, ['store', 'uid'], ['data', 'sync_version', 'last_modified_by', 'updated_at']);
        }

        return $uids;
    }

    /**
     * @param list<string> $recordUids
     * @return array{count: int, bytes: int}
     */
    private function generateFiles(int $seed, int $count, int $totalSize, string $disk, array $recordUids, int $chunkSize): array
    {
        if ($count === 0 || $recordUids === []) {
            return ['count' => 0, 'bytes' => 0];
        }

        $sizes = $this->distributeSizes($seed, $count, $totalSize);
        $storage = Storage::disk($disk);
        $recordCount = count($recordUids);
        $batch = [];
        $bytesWritten = 0;

        foreach ($sizes as $index => $size) {
            $recordUid = $recordUids[$index % $recordCount];
            $path = self::STORE.'/'.$seed.'/file-'.sprintf('%06d', $index).'.bin';

            $checksum = $this->writeDeterministicFile($storage, $path, $seed, $index, $size);
            $bytesWritten += $size;

            $batch[] = [
                'id' => (string) Str::uuid5(self::UUID_NAMESPACE, $seed.':'.$index),
                'record_store' => self::STORE,
                'record_uid' => $recordUid,
                'disk' => $disk,
                'path' => $path,
                'original_name' => 'benchmark-file-'.$index.'.bin',
                'mime_type' => 'application/octet-stream',
                'size_bytes' => $size,
                'checksum_sha256' => $checksum,
                'is_primary' => intdiv($index, $recordCount) === 0,
                'processing_status' => 'ready',
                'created_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (count($batch) >= $chunkSize) {
                DB::table('record_attachments')->upsert($batch, ['disk', 'path'], ['record_uid', 'size_bytes', 'checksum_sha256', 'is_primary', 'updated_at']);
                $batch = [];
            }
        }

        if ($batch !== []) {
            DB::table('record_attachments')->upsert($batch, ['disk', 'path'], ['record_uid', 'size_bytes', 'checksum_sha256', 'is_primary', 'updated_at']);
        }

        return ['count' => count($sizes), 'bytes' => $bytesWritten];
    }

    /**
     * Deterministically splits $totalSize across $count files using a seeded
     * PRNG (weights derived from mt_rand under a fixed seed, not real entropy).
     *
     * @return list<int>
     */
    private function distributeSizes(int $seed, int $count, int $totalSize): array
    {
        if ($totalSize <= 0) {
            return array_fill(0, $count, 0);
        }

        mt_srand($seed);
        $weights = [];
        $weightSum = 0;
        for ($i = 0; $i < $count; $i++) {
            $weight = mt_rand(1, 1000);
            $weights[] = $weight;
            $weightSum += $weight;
        }

        $sizes = [];
        $allocated = 0;
        foreach ($weights as $i => $weight) {
            if ($i === $count - 1) {
                $sizes[] = max(0, $totalSize - $allocated);
                break;
            }
            $size = (int) floor($totalSize * $weight / $weightSum);
            $sizes[] = $size;
            $allocated += $size;
        }

        return $sizes;
    }

    /**
     * Streams a deterministic, non-real byte pattern to disk in fixed-size
     * chunks (never buffers the whole file in memory, so this is safe for the
     * 1GB-scale production run) and returns its sha256 checksum.
     */
    private function writeDeterministicFile(\Illuminate\Contracts\Filesystem\Filesystem $storage, string $path, int $seed, int $index, int $size): string
    {
        $chunkBytes = 65536;
        $seedBlock = hash('sha256', $seed.':'.$index, true);

        $stream = fopen('php://temp/maxmemory:'.$chunkBytes, 'w+b');
        if ($stream === false) {
            throw new \RuntimeException("Unable to open temp stream for {$path}");
        }

        $context = hash_init('sha256');
        $written = 0;
        $block = $seedBlock;

        while ($written < $size) {
            $take = min($chunkBytes, $size - $written);
            $chunk = '';
            while (strlen($chunk) < $take) {
                $block = hash('sha256', $block, true);
                $chunk .= $block;
            }
            $chunk = substr($chunk, 0, $take);

            fwrite($stream, $chunk);
            hash_update($context, $chunk);
            $written += $take;
        }

        rewind($stream);
        $storage->put($path, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }

        return hash_final($context);
    }
}
