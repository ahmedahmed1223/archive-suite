<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            // ponytail: sqlite (tests/CI) has no tsvector type. The keyword
            // search path falls back to the existing PHP filter there (see
            // SearchController::index), so no shadow column is needed.
            return;
        }

        // 'simple' on purpose: archive content is primarily Arabic and stock
        // Postgres ships no Arabic text-search config. 'simple' tokenizes and
        // lowercases without English-specific stemming, which would otherwise
        // mangle Arabic tokens.
        DB::statement(<<<'SQL'
            ALTER TABLE storage_rows ADD COLUMN search_vector tsvector
            GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', coalesce(data->>'title', '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(data->>'description', '')), 'B') ||
                setweight(to_tsvector('simple', coalesce(data->>'type', '') || ' ' || coalesce(data->>'subtype', '')), 'C') ||
                setweight(to_tsvector('simple', coalesce(data->>'tags', '')), 'D')
            ) STORED
        SQL);

        DB::statement('CREATE INDEX storage_rows_search_vector_idx ON storage_rows USING GIN (search_vector)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS storage_rows_search_vector_idx');
        Schema::table('storage_rows', function ($table): void {
            $table->dropColumn('search_vector');
        });
    }
};
