<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\HealthService;

/**
 * Salud de proyectos — solo admin/coordinator (middleware role en rutas).
 */
class HealthController extends Controller
{
    /** GET /reports/health */
    public function portfolio()
    {
        return response()->json(HealthService::portfolio());
    }

    /** GET /projects/{project}/health */
    public function project(Project $project)
    {
        return response()->json(HealthService::forProject($project));
    }
}
