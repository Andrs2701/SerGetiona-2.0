<?php

namespace App\Providers;

use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Observers\AuditObserver;
use App\Observers\RoleActivityObserver;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        ResetPassword::createUrlUsing(function ($user, string $token): string {
            $frontendUrl = rtrim((string) config('app.frontend_url', env('FRONTEND_URL')), '/');

            return $frontendUrl.'/reset-password?token='.urlencode($token)
                .'&email='.urlencode($user->getEmailForPasswordReset());
        });

        Project::observe(AuditObserver::class);
        Deliverable::observe(AuditObserver::class);
        RoleActivity::observe(RoleActivityObserver::class);
        RoleActivity::observe(AuditObserver::class);
    }
}
