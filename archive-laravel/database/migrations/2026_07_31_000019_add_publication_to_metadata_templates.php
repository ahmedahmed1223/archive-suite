<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('metadata_templates', function (Blueprint $table): void {
            $table->unsignedInteger('published_version')->nullable()->index();
            $table->string('published_by_id')->nullable();
            $table->timestamp('published_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('metadata_templates', function (Blueprint $table): void {
            $table->dropColumn(['published_version', 'published_by_id', 'published_at']);
        });
    }
};
