<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vocabulary_terms', function (Blueprint $t): void {
            $t->string('canonical_term_id')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('vocabulary_terms', function (Blueprint $t): void {
            $t->dropColumn('canonical_term_id');
        });
    }
};
