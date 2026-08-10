<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Search\EmbeddingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use stdClass;

class EmbeddingsSync extends Command
{
    protected $signature = 'embeddings:sync {--store=records} {--limit=} {--rate-limit=} {--dry-run}';

    protected $description = 'Backfill/refresh pgvector embeddings for a storage_rows store.';

    // ponytail: fixed field list mirrors the fields SuggestionsController
    // already treats as a record's text content (see missing-description
    // rule); extend if more searchable fields show up.
    private const TEXT_FIELDS = ['title', 'description', 'body', 'summary', 'notes'];

    public function __construct(private readonly EmbeddingService $embeddings)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if (! $this->embeddings->isEnabled()) {
            $this->info('Embeddings disabled (EMBEDDINGS_ENABLED=false, missing OPENAI_API_KEY, or non-Postgres driver). Nothing to do.');

            return 0;
        }

        $store = (string) $this->option('store');
        $dryRun = (bool) $this->option('dry-run');
        $maxCalls = $this->option('limit') !== null
            ? max(0, (int) $this->option('limit'))
            : max(0, (int) config('embeddings.sync_max_calls_per_run', 1000));
        $ratePerMinute = $this->option('rate-limit') !== null
            ? max(1, (int) $this->option('rate-limit'))
            : max(1, (int) config('embeddings.sync_rate_limit_per_minute', 60));
        $minIntervalMicros = (int) round(60_000_000 / $ratePerMinute);

        $processed = 0;
        $embedded = 0;
        $skipped = 0;
        $capped = 0;
        $lastCallAt = null;

        DB::table('storage_rows')
            ->where('store', $store)
            ->orderBy('uid')
            ->chunkById(200, function ($rows) use (
                &$processed, &$embedded, &$skipped, &$capped, &$lastCallAt,
                $store, $dryRun, $maxCalls, $minIntervalMicros,
            ): bool {
                foreach ($rows as $row) {
                    /** @var stdClass $row */
                    $processed++;

                    $text = $this->extractText((string) $row->data);
                    if ($text === '') {
                        $skipped++;

                        continue;
                    }

                    $contentHash = hash('sha256', config('embeddings.model').':'.$text);
                    $existingHash = DB::table('record_embeddings')
                        ->where('store', $store)
                        ->where('uid', $row->uid)
                        ->value('content_hash');

                    if ($existingHash === $contentHash) {
                        $skipped++;

                        continue;
                    }

                    if ($embedded >= $maxCalls) {
                        $capped++;

                        continue;
                    }

                    if ($dryRun) {
                        $embedded++;

                        continue;
                    }

                    if ($lastCallAt !== null) {
                        $elapsed = hrtime(true) / 1000 - $lastCallAt;
                        if ($elapsed < $minIntervalMicros) {
                            usleep((int) ($minIntervalMicros - $elapsed));
                        }
                    }

                    $this->embeddings->upsert($store, $row->uid, $text);
                    $lastCallAt = hrtime(true) / 1000;
                    $embedded++;
                }

                // Stop pulling further chunks once the spend cap is hit for this run.
                return $embedded < $maxCalls;
            }, 'uid');

        $label = $dryRun ? 'would-embed' : 'embedded';
        $this->info("Processed: {$processed}, {$label}: {$embedded}, skipped-unchanged: {$skipped}, capped-by-limit: {$capped}.");

        if ($capped > 0) {
            $this->warn("Spend cap ({$maxCalls} calls) reached this run; re-run embeddings:sync to continue.");
        }

        return 0;
    }

    private function extractText(string $json): string
    {
        $data = json_decode($json, true);
        if (! is_array($data)) {
            return '';
        }

        $parts = [];
        foreach (self::TEXT_FIELDS as $field) {
            $value = trim((string) ($data[$field] ?? ''));
            if ($value !== '') {
                $parts[] = $value;
            }
        }

        return implode("\n", $parts);
    }
}
