<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_field_requests', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('record_id')->index();
            $table->string('field');
            $table->text('message');
            $table->string('assignee')->nullable()->index();
            $table->date('due_date')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamp('resolved_at')->nullable()->index();
            $table->string('resolved_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_field_requests');
    }
};
