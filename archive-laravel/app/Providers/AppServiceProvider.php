<?php

namespace App\Providers;

use App\Services\Media\FakeMediaProcessor;
use App\Services\Media\MediaProcessor;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(MediaProcessor::class, FakeMediaProcessor::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
