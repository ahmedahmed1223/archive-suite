<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_comments', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('media_uid')->index();
            $table->decimal('timecode_seconds', 10, 3)->index();
            $table->string('author');
            $table->text('body');
            $table->boolean('resolved')->default(false)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_comments');
    }
};
