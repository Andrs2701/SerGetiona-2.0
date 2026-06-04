<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\DeliverableController;
use App\Http\Controllers\Api\ProgramController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleActivityController;
use App\Http\Controllers\Api\SubjectController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Públicas
Route::post('/auth/login', [AuthController::class, 'login']);

// Protegidas con Sanctum
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    Route::apiResource('projects', ProjectController::class);
    Route::apiResource('programs', ProgramController::class);
    Route::apiResource('subjects', SubjectController::class);
    Route::apiResource('deliverables', DeliverableController::class);
    Route::put('activities/{activity}', [RoleActivityController::class, 'update']);
    Route::post('deliverables/{deliverable}/apply-template', [DeliverableController::class, 'applyFlowTemplate']);
    Route::get('deliverables/{deliverable}/comments', [CommentController::class, 'index']);
    Route::post('deliverables/{deliverable}/comments', [CommentController::class, 'store']);
    Route::apiResource('users', UserController::class);
    Route::get('reports/dashboard', [ReportController::class, 'dashboard']);
    Route::get('reports/compliance', [ReportController::class, 'compliance']);
});
