<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_comments', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('item_id')->index();
            $table->text('body');
            $table->string('author_id')->nullable()->index();
            $table->string('author_name')->default('مجهول');
            $table->timestamp('deleted_at')->nullable()->index();
            $table->timestamps();

            $table->index(['item_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_comments');
    }
};
