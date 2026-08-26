<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('montage_project_revisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('montage_project_id');
            $table->unsignedInteger('revision_number');
            $table->foreignId('created_by')->constrained('users');
            $table->json('tracks')->default('[]');
            $table->json('clips')->default('[]');
            $table->json('effects')->default('[]');
            $table->json('markers')->default('[]');
            $table->json('comments')->default('[]');
            $table->json('transitions')->default('[]');
            $table->string('source_version_token', 128)->nullable()->index();
            $table->timestamps();

            $table->unique(['montage_project_id', 'revision_number']);
            $table->index(['montage_project_id', 'created_at']);
        });

        Schema::table('montage_projects', function (Blueprint $table): void {
            $table->unsignedInteger('revision')->default(0)->after('status');
            $table->uuid('active_revision_id')->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users');
            $table->foreign('active_revision_id')
                ->references('id')->on('montage_project_revisions')
                ->nullOnDelete();
        });

        Schema::create('montage_exports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('montage_project_id');
            $table->uuid('montage_project_revision_id');
            $table->foreignId('requested_by')->constrained('users');
            $table->string('preset', 64);
            $table->string('status')->default('queued')->index();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->json('settings')->nullable();
            $table->string('checksum', 128)->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->foreign('montage_project_id')->references('id')->on('montage_projects')->cascadeOnDelete();
            $table->foreign('montage_project_revision_id')->references('id')->on('montage_project_revisions')->cascadeOnDelete();
            $table->index(['montage_project_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('montage_exports');

        Schema::table('montage_projects', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('owner_id');
            $table->dropColumn(['revision', 'active_revision_id']);
        });

        Schema::dropIfExists('montage_project_revisions');
    }
};
