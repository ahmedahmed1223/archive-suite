<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V3-WORK-003: admin-configurable catalog of which bulk-macro step types
 * require dual approval before they may run. Keyed by the same step 'type'
 * strings BulkMacroService already validates (see
 * BulkMacrosController::validateMacro()). All rows start sensitive=false so
 * existing bulk-macro behavior is unchanged until an admin opts a step type
 * in -- see ApprovalRequestService::submit().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sensitive_operation_policies', function (Blueprint $table): void {
            $table->string('operation_key')->primary();
            $table->boolean('sensitive')->default(false);
            $table->unsignedTinyInteger('required_approvals')->default(2);
            $table->timestamps();
        });

        $now = now();
        DB::table('sensitive_operation_policies')->insert(
            array_map(
                fn (string $key): array => [
                    'operation_key' => $key,
                    'sensitive' => false,
                    'required_approvals' => 2,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                ['delete', 'add-tag', 'set-workflow-status', 'set-rights-holder'],
            ),
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('sensitive_operation_policies');
    }
};
