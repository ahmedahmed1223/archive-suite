<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_derivatives', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('record_store');
            $table->string('record_uid');
            // Nullable: null means the derivative is generated from the
            // record's primary source rather than a specific
            // record_attachments row -- same convention as
            // review_sessions.attachment_id / media_clips.attachment_id.
            $table->uuid('attachment_id')->nullable();
            // thumbnail | waveform | proxy (V3-MEDIA-006).
            $table->string('derivative_type');
            // Same checksum-derived identity as review_sessions.version_token
            // and media_clips.version_token (see ReviewSessionService::
            // resolveVersionToken, which this table's writes reuse). A
            // derivative generated against an older version must never be
            // served as current once the source is replaced -- see
            // MediaDerivativeService::isCurrentVersion.
            $table->string('version_token');
            $table->json('settings');
            // sha256 of the normalized (recursively key-sorted) settings
            // JSON. Lets two requests for the same type+version but
            // different generation settings (e.g. a different proxy
            // bitrate) cache independently instead of colliding.
            $table->string('settings_hash', 64);
            $table->string('status')->default('pending'); // pending | processing | ready | failed
            // Set once the backing MediaJob promotes its staged output to
            // its final location -- see RealMediaProcessor's
            // stageDerivativeOutput()/promoteStagedOutput().
            $table->string('storage_key')->nullable();
            // No FK: media_jobs rows are pruned by retention policy
            // (media:prune-jobs) independently of this table's lifecycle.
            $table->string('media_job_id')->nullable();
            $table->text('error')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['record_store', 'record_uid']);
            $table->index('attachment_id');
            $table->index('media_job_id');
            // Best-effort cache-key backstop: NULL is distinct-from-NULL in a
            // SQL unique index, so this does not fully protect the
            // no-attachment case against a rare concurrent double-insert.
            // MediaDerivativeService::findOrCreatePending()'s read-before-write
            // is the primary defense; this index mainly speeds that lookup
            // and prevents duplicates in the (much more common) attachment-scoped case.
            $table->unique(
                ['record_store', 'record_uid', 'attachment_id', 'derivative_type', 'version_token', 'settings_hash'],
                'media_derivatives_cache_key_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_derivatives');
    }
};
