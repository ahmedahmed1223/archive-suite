<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V1-731 (B07): the trash is a separate table, not a `deleted_at` column on
 * storage_rows.
 *
 * Reason: records are read through ~45 raw `DB::table('storage_rows')` query
 * sites (search, sync, discover, public catalog, backups, embeddings, ingest,
 * ...). Eloquent's SoftDeletes trait only filters queries that go through the
 * model, and only SecuritySettingsService uses the StorageRow model — so a
 * soft-deleted row would keep surfacing in every one of those readers unless
 * each grew a `whereNull('deleted_at')`. Moving the row out of storage_rows
 * keeps all of them correct with no change, and restore puts the original
 * payload back verbatim.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trashed_records', function (Blueprint $table): void {
            $table->id();
            $table->string('store');
            $table->string('uid');
            $table->json('data');
            $table->unsignedInteger('sync_version')->nullable();
            $table->json('last_modified_by')->nullable();
            // Preserved so a restore rebuilds the storage_rows row as it was.
            $table->timestamp('original_created_at')->nullable();
            $table->timestamp('original_updated_at')->nullable();
            $table->timestamp('deleted_at')->index();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();

            // One trash entry per record; re-deleting the same uid replaces it.
            $table->unique(['store', 'uid']);
            $table->index('store');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trashed_records');
    }
};
