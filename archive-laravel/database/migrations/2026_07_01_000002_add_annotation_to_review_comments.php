<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('review_comments', function (Blueprint $table): void {
            // Normalized-coordinate annotation shapes (rectangles in [0,1]) for the
            // frame this comment refers to. Nullable — most comments have none.
            $table->json('annotation')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('review_comments', function (Blueprint $table): void {
            $table->dropColumn('annotation');
        });
    }
};
