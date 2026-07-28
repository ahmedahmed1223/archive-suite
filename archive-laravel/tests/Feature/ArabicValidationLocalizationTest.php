<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * V1-823: the backend half of V1-818. APP_LOCALE now defaults to 'ar', and
 * lang/ar/validation.php supplies Arabic wording for the rules the API
 * controllers actually use. This is a behavioral test through the real
 * Validator/Translator stack, not a static file scan -- it catches the app
 * locale not actually being 'ar' at runtime, not just the file existing.
 */
class ArabicValidationLocalizationTest extends TestCase
{
    public function test_app_locale_defaults_to_arabic(): void
    {
        $this->assertSame('ar', app()->getLocale());
    }

    public function test_fallback_locale_stays_english_so_unmapped_rules_degrade_safely(): void
    {
        $this->assertSame('en', app('config')->get('app.fallback_locale'));
    }

    public function test_required_rule_message_is_arabic(): void
    {
        $validator = Validator::make([], ['title' => 'required']);
        $validator->fails();

        $this->assertStringContainsString('مطلوب', $validator->errors()->first('title'));
        $this->assertStringNotContainsString('required', $validator->errors()->first('title'));
    }

    public function test_string_max_and_email_rules_are_arabic(): void
    {
        $validator = Validator::make(
            ['name' => str_repeat('a', 10), 'contact' => 'not-an-email'],
            ['name' => ['string', 'max:5'], 'contact' => ['email']],
        );
        $validator->fails();

        $this->assertStringContainsString('حرفاً', $validator->errors()->first('name'));
        $this->assertStringContainsString('بريداً إلكترونياً', $validator->errors()->first('contact'));
    }

    public function test_an_unmapped_rule_falls_back_to_english_instead_of_a_missing_key(): void
    {
        // 'alpha' has no entry in lang/ar/validation.php on purpose (unused in
        // this app's controllers) -- this proves the fallback_locale path works
        // rather than surfacing the raw translation key or an untranslated line.
        $validator = Validator::make(['code' => '123'], ['code' => ['alpha']]);
        $validator->fails();

        $this->assertStringContainsString('must only contain letters', $validator->errors()->first('code'));
    }

    public function test_a_real_validated_endpoint_returns_arabic_errors(): void
    {
        // Registered under /api/ deliberately: bootstrap/app.php's
        // shouldRenderJsonWhen forces JSON error rendering only for paths
        // matching `api/*`, same as every real V1 controller route. A route
        // outside that prefix would 302-redirect on failed validation instead
        // of returning JSON, which is not what this test is meant to probe.
        Route::post('/api/__test/arabic-validation-probe', function () {
            request()->validate(['title' => 'required|string|max:5']);

            return response()->json(['ok' => true]);
        })->middleware('api');

        $response = $this->postJson('/api/__test/arabic-validation-probe', ['title' => 'too-long-for-the-limit']);

        $response->assertStatus(422);
        $message = $response->json('errors.title.0');
        $this->assertNotNull($message);
        $this->assertStringContainsString('حرفاً', $message);
    }
}
