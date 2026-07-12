<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Search\EmbeddingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use stdClass;

class EmbeddingsSync extends Command
{
    protected $signature = 'embeddings:sync {--store=records}';

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
        $processed = 0;
        $embedded = 0;
        $skipped = 0;

        DB::table('storage_rows')
            ->where('store', $store)
            ->orderBy('uid')
            ->chunkById(200, function ($rows) use (&$processed, &$embedded, &$skipped, $store): void {
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

                    $this->embeddings->upsert($store, $row->uid, $text);
                    $embedded++;
                }
            }, 'uid');

        $this->info("Processed: {$processed}, embedded: {$embedded}, skipped-unchanged: {$skipped}.");

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
