<?php

declare(strict_types=1);

namespace App\Services\Search;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Thin wrapper around an OpenAI-compatible embeddings endpoint + pgvector
 * storage. Every public method is a safe no-op when disabled, misconfigured,
 * or not running on Postgres — callers never need their own driver checks.
 */
class EmbeddingService
{
    public function isEnabled(): bool
    {
        return (bool) config('embeddings.enabled')
            && ! empty(config('embeddings.api_key'))
            && DB::getDriverName() === 'pgsql';
    }

    /**
     * @return list<float>|null
     */
    public function embed(string $text): ?array
    {
        if (! $this->isEnabled()) {
            return null;
        }

        $text = trim($text);
        if ($text === '') {
            return null;
        }

        try {
            $response = Http::withToken((string) config('embeddings.api_key'))
                ->timeout(15)
                ->post(rtrim((string) config('embeddings.base_url'), '/').'/embeddings', [
                    'model' => config('embeddings.model'),
                    'input' => $text,
                ]);
        } catch (Throwable $e) {
            Log::warning('embeddings.embed: request failed', ['error' => $e->getMessage()]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('embeddings.embed: non-2xx response', ['status' => $response->status()]);

            return null;
        }

        $vector = $response->json('data.0.embedding');
        if (! is_array($vector) || $vector === []) {
            Log::warning('embeddings.embed: unexpected response shape');

            return null;
        }

        return array_map(static fn (mixed $value): float => (float) $value, $vector);
    }

    public function upsert(string $store, string $uid, string $text): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $contentHash = $this->contentHash($text);

        $existingHash = DB::table('record_embeddings')
            ->where('store', $store)
            ->where('uid', $uid)
            ->value('content_hash');

        if ($existingHash === $contentHash) {
            return;
        }

        $vector = $this->embed($text);
        if ($vector === null) {
            return;
        }

        $vectorLiteral = $this->toVectorLiteral($vector);
        $now = now();

        DB::statement(
            'INSERT INTO record_embeddings (store, uid, content_hash, embedding, created_at, updated_at)
             VALUES (:store, :uid, :hash, :vec::vector, :now, :now2)
             ON CONFLICT (store, uid) DO UPDATE SET content_hash = :hash2, embedding = :vec2::vector, updated_at = :now3',
            [
                'store' => $store,
                'uid' => $uid,
                'hash' => $contentHash,
                'vec' => $vectorLiteral,
                'now' => $now,
                'now2' => $now,
                'hash2' => $contentHash,
                'vec2' => $vectorLiteral,
                'now3' => $now,
            ]
        );
    }

    /**
     * Ordered nearest-first uid list, or null when semantic search can't run
     * (disabled, or the query itself failed to embed) — callers fall back to
     * keyword search on null.
     *
     * ponytail: single ANN pass via cosine distance, no re-ranking/hybrid
     * scoring. Add a re-rank stage if pure-vector recall proves insufficient.
     *
     * @return list<string>|null
     */
    public function search(string $queryText, ?string $store, int $limit): ?array
    {
        if (! $this->isEnabled()) {
            return null;
        }

        $vector = $this->embed($queryText);
        if ($vector === null) {
            return null;
        }

        $limit = max(1, $limit);
        $bindings = ['vec' => $this->toVectorLiteral($vector)];

        $storeSql = '';
        if ($store !== null) {
            $storeSql = 'WHERE store = :store';
            $bindings['store'] = $store;
        }

        $rows = DB::select(
            "SELECT uid FROM record_embeddings {$storeSql} ORDER BY embedding <=> :vec::vector LIMIT {$limit}",
            $bindings
        );

        return array_map(static fn (object $row): string => (string) $row->uid, $rows);
    }

    private function contentHash(string $text): string
    {
        return hash('sha256', config('embeddings.model').':'.$text);
    }

    /**
     * @param  list<float>  $vector
     */
    private function toVectorLiteral(array $vector): string
    {
        return '['.implode(',', $vector).']';
    }
}
