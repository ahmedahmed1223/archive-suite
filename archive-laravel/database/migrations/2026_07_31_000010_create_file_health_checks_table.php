<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_health_checks', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->uuid('attachment_id')->index();
            $table->string('status');
            $table->string('checksum_sha256')->nullable();
            $table->timestamp('checked_at')->useCurrent();

            $table->foreign('attachment_id')->references('id')->on('record_attachments')->cascadeOnDelete();
            $table->index(['attachment_id', 'checked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_health_checks');
    }
};
