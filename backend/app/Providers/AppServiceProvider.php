<?php

namespace App\Providers;

use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Observers\AuditObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Project::observe(AuditObserver::class);
        Deliverable::observe(AuditObserver::class);
        RoleActivity::observe(AuditObserver::class);
    }
}
