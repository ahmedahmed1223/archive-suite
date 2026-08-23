<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V14-UX-REVIEW: refresh-token reuse grace window.
 *
 * Rotating the refresh token by hard-deleting the ApiSession row meant two
 * parallel page loads (multi-tab, or a fast navigation race) both carrying the
 * same va_refresh cookie would race: the first refresh deletes the row, the
 * second finds nothing and gets 401 -> the client drops to guest and bounces
 * the user to /login mid-use. Remembering the immediately-previous hash with
 * a timestamp lets refresh() accept a just-rotated token for a few seconds.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_sessions', function (Blueprint $table): void {
            $table->string('previous_refresh_token_hash')->nullable()->after('refresh_token_hash');
            $table->string('previous_access_token_hash')->nullable()->after('previous_refresh_token_hash');
            $table->timestamp('rotated_at')->nullable()->after('last_used_at');
        });
    }

    public function down(): void
    {
        Schema::table('api_sessions', function (Blueprint $table): void {
            $table->dropColumn(['previous_refresh_token_hash', 'previous_access_token_hash', 'rotated_at']);
        });
    }
};
