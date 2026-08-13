<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('record_field_requests', function (Blueprint $table): void {
            $table->string('department_id')->nullable()->index();
            $table->string('field_owner')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('record_field_requests', fn (Blueprint $table) => $table->dropColumn(['department_id', 'field_owner']));
    }
};
