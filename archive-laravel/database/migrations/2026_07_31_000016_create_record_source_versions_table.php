<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void { Schema::create('record_source_versions', function (Blueprint $t): void { $t->uuid('id')->primary(); $t->string('record_store'); $t->string('record_uid'); $t->json('record_data'); $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete(); $t->timestamps(); $t->index(['record_store','record_uid']); }); }
    public function down(): void { Schema::dropIfExists('record_source_versions'); }
};
