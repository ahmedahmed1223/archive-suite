<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inbox_items', function (Blueprint $table): void {
            $table->string('department_id')->nullable()->index();
            $table->json('routing_history')->nullable();
        });
    }

    public function down(): void { Schema::table('inbox_items', fn (Blueprint $table) => $table->dropColumn(['department_id', 'routing_history'])); }
};
