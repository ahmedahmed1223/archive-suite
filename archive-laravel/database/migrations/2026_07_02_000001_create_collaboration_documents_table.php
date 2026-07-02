<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collaboration_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('room_key')->index();
            $table->string('resource_id')->index();
            $table->longText('content');
            $table->unsignedInteger('version')->default(1);
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('updated_by_display_name')->nullable();
            $table->timestamps();

            $table->unique(['room_key', 'resource_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collaboration_documents');
    }
};
