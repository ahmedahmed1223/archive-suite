<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('montage_exports', function (Blueprint $table): void {
            $table->string('idempotency_key', 64)->nullable()->unique();
            // Media jobs are pruned independently, so this is an indexed
            // audit link rather than a foreign key.
            $table->string('media_job_id')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('montage_exports', function (Blueprint $table): void {
            $table->dropUnique(['idempotency_key']);
            $table->dropIndex(['media_job_id']);
            $table->dropColumn(['idempotency_key', 'media_job_id']);
        });
    }
};
