<?php

/**
 * V1-X04 live AI/embeddings driver.
 *
 * Drives the product EmbeddingService against a live OpenAI-compatible
 * embeddings endpoint and a live pgvector index, and emits JSON on stdout.
 * The API key is never printed -- only booleans, dimensions and counts.
 *
 * Usage: php x04-embeddings.php <identity|index-query|isolation|safe-failure|limits>
 */

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\Search\EmbeddingService;
use Illuminate\Support\Facades\DB;

const STORE_A = 'x04-store-a';
const STORE_B = 'x04-store-b';

function emit(array $payload): void
{
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n";
}

function clean(): void
{
    DB::table('record_embeddings')->whereIn('store', [STORE_A, STORE_B])->delete();
}

$phase = $argv[1] ?? 'identity';

try {
    $embeddings = app(EmbeddingService::class);

    if ($phase === 'identity') {
        $vector = $embeddings->embed('أرشيف القناة الفضائية');
        $expected = (int) config('embeddings.dimensions');
        emit([
            'phase' => 'identity',
            'ok' => is_array($vector) && count($vector) === $expected,
            'enabled' => $embeddings->isEnabled(),
            'driver' => DB::getDriverName(),
            'dimensions' => is_array($vector) ? count($vector) : null,
            'expectedDimensions' => $expected,
            'apiKeyConfigured' => ! empty(config('embeddings.api_key')),
            'baseUrlConfigured' => trim((string) config('embeddings.base_url')) !== '',
        ]);
        exit(0);
    }

    if ($phase === 'index-query') {
        clean();
        $embeddings->upsert(STORE_A, 'rec-gaza', 'تقرير إخباري عن غزة والقصف على المستشفيات');
        $embeddings->upsert(STORE_A, 'rec-cooking', 'برنامج طبخ لتحضير الكبسة والأرز باللحم');
        $embeddings->upsert(STORE_A, 'rec-football', 'مباراة كرة قدم في الدوري السعودي للمحترفين');
        $indexed = DB::table('record_embeddings')->where('store', STORE_A)->count();

        // Semantic, not keyword: none of these query words appear in the stored text.
        $hits = $embeddings->search('أخبار الحرب والضحايا', STORE_A, 3);
        $top = is_array($hits) && $hits !== [] ? ($hits[0]->uid ?? $hits[0]['uid'] ?? null) : null;

        emit([
            'phase' => 'index-query',
            'ok' => $indexed === 3 && $top === 'rec-gaza',
            'indexedRows' => $indexed,
            'hitsReturned' => is_array($hits) ? count($hits) : null,
            'topMatch' => $top,
            'semanticNotKeyword' => $top === 'rec-gaza',
        ]);
        exit(0);
    }

    if ($phase === 'isolation') {
        clean();
        $embeddings->upsert(STORE_A, 'a-only', 'تقرير إخباري عن غزة والقصف');
        $embeddings->upsert(STORE_B, 'b-only', 'تقرير إخباري عن غزة والقصف');

        $inA = $embeddings->search('أخبار الحرب', STORE_A, 10) ?? [];
        $uidsA = array_map(static fn ($row) => $row->uid ?? $row['uid'] ?? null, $inA);
        $inB = $embeddings->search('أخبار الحرب', STORE_B, 10) ?? [];
        $uidsB = array_map(static fn ($row) => $row->uid ?? $row['uid'] ?? null, $inB);

        emit([
            'phase' => 'isolation',
            'ok' => in_array('a-only', $uidsA, true) && ! in_array('b-only', $uidsA, true)
                && in_array('b-only', $uidsB, true) && ! in_array('a-only', $uidsB, true),
            'storeAUids' => $uidsA,
            'storeBUids' => $uidsB,
            'crossStoreLeak' => in_array('b-only', $uidsA, true) || in_array('a-only', $uidsB, true),
        ]);
        exit(0);
    }

    // Run with the provider unreachable: degrade to null, never throw, and never
    // write a row that would later look like a valid embedding.
    if ($phase === 'safe-failure') {
        clean();
        $threw = false;
        $vector = false;
        try {
            $vector = $embeddings->embed('أرشيف');
        } catch (Throwable $e) {
            $threw = true;
        }
        $upsertThrew = false;
        try {
            $embeddings->upsert(STORE_A, 'should-not-exist', 'نص لا يجب أن يُفهرس');
        } catch (Throwable $e) {
            $upsertThrew = true;
        }
        $rows = DB::table('record_embeddings')->where('store', STORE_A)->count();
        emit([
            'phase' => 'safe-failure',
            'ok' => ! $threw && ! $upsertThrew && $vector === null && $rows === 0,
            'embedThrew' => $threw,
            'upsertThrew' => $upsertThrew,
            'embedReturnedNull' => $vector === null,
            'rowsWritten' => $rows,
        ]);
        exit(0);
    }

    // Reports what the product actually enforces. Only a timeout exists, and it
    // is hardcoded; there is no rate limit, cost ceiling or backoff anywhere on
    // the embeddings path, and EmbeddingsSync chunks the whole table calling a
    // billable endpoint once per row.
    if ($phase === 'limits') {
        $source = (string) file_get_contents(__DIR__.'/../../app/Services/Search/EmbeddingService.php');
        $syncSource = (string) file_get_contents(__DIR__.'/../../app/Console/Commands/EmbeddingsSync.php');
        preg_match('/->timeout\((\d+)\)/', $source, $m);
        $combined = $source.$syncSource;
        emit([
            'phase' => 'limits',
            'ok' => false, // documented gap, not a pass
            'timeoutSeconds' => isset($m[1]) ? (int) $m[1] : null,
            'timeoutConfigurable' => str_contains($source, "config('embeddings.timeout"),
            'rateLimitPresent' => (bool) preg_match('/RateLimiter|throttle|usleep|sleep\(/i', $combined),
            'costCapPresent' => (bool) preg_match('/budget|max_calls|spend|cost_limit/i', $combined),
            'syncIteratesWholeTable' => str_contains($syncSource, 'chunkById'),
            'note' => 'only a hardcoded timeout is enforced; no rate limit, cost ceiling or backoff',
        ]);
        exit(0);
    }

    emit(['phase' => $phase, 'ok' => false, 'error' => 'unknown phase']);
    exit(2);
} catch (Throwable $e) {
    emit(['phase' => $phase, 'ok' => false, 'error' => mb_substr($e->getMessage(), 0, 300)]);
    exit(1);
}
