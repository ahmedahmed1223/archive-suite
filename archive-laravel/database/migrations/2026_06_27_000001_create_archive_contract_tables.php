<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storage_rows', function (Blueprint $table): void {
            $table->string('store');
            $table->string('uid');
            $table->json('data');
            $table->unsignedInteger('sync_version')->nullable();
            $table->json('last_modified_by')->nullable();
            $table->timestamps();

            $table->primary(['store', 'uid']);
            $table->index('store');
            $table->index('created_at');
            $table->index('sync_version');
        });

        Schema::create('rights_records', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('item_id')->unique();
            $table->string('rights_holder');
            $table->string('license_type')->default('UNKNOWN');
            $table->timestamp('embargo_start')->nullable();
            $table->timestamp('embargo_end')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->json('geo_restrictions')->default('[]');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('item_id');
            $table->index('license_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rights_records');
        Schema::dropIfExists('storage_rows');
    }
};
