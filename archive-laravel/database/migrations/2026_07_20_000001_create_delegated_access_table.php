<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delegated_access', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('grantor_id')->constrained('users');
            $table->foreignId('grantee_id')->constrained('users');
            $table->json('scope');
            $table->string('permission')->default('editor');
            $table->timestamp('expires_at')->index();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delegated_access');
    }
};
