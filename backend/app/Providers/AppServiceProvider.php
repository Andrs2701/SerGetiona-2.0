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
        ResetPassword::createUrlUsing(fn ($user, string $token): string => $user->passwordResetUrl($token));

        Project::observe(AuditObserver::class);
        Deliverable::observe(AuditObserver::class);
        RoleActivity::observe(RoleActivityObserver::class);
        RoleActivity::observe(AuditObserver::class);
    }
}
