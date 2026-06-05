<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\DeliverableController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProgramController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleActivityController;
use App\Http\Controllers\Api\SubjectController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\EvidenceLinkController;
use App\Http\Controllers\Api\WorkspaceController;
use Illuminate\Support\Facades\Route;

// Públicas
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

// Protegidas con Sanctum
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

    // Notificaciones
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // Calendario
    Route::get('/calendar-events', [CalendarController::class, 'index']);
    Route::post('/calendar-events', [CalendarController::class, 'store'])->middleware('role:admin,coordinator');
    Route::put('/calendar-events/{event}', [CalendarController::class, 'update'])->middleware('role:admin,coordinator');
    Route::delete('/calendar-events/{event}', [CalendarController::class, 'destroy'])->middleware('role:admin,coordinator');
    Route::post('/calendar/suggest-dates', [CalendarController::class, 'suggestDates']);
    Route::get('/calendar/my-deliverables', [CalendarController::class, 'myDeliverables']);

    // Workspace personal
    Route::get('/my-workspace', [WorkspaceController::class, 'index']);

    // Proyectos (admin y coordinator pueden crear/eliminar)
    Route::get('projects', [ProjectController::class, 'index']);
    Route::get('projects/{project}', [ProjectController::class, 'show']);
    Route::post('projects', [ProjectController::class, 'store'])->middleware('role:admin,coordinator');
    Route::put('projects/{project}', [ProjectController::class, 'update'])->middleware('role:admin,coordinator');
    Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->middleware('role:admin,coordinator');

    Route::apiResource('programs', ProgramController::class);
    Route::apiResource('subjects', SubjectController::class);
    Route::apiResource('deliverables', DeliverableController::class);
    Route::put('activities/{activity}', [RoleActivityController::class, 'update']);
    Route::post('activities/{activity}/quick-action', [RoleActivityController::class, 'quickAction']);

    // Evidence links
    Route::get('deliverables/{deliverable}/evidence', [EvidenceLinkController::class, 'byDeliverable']);
    Route::post('role-activities/{activity}/evidence', [EvidenceLinkController::class, 'store']);
    Route::delete('evidence/{link}', [EvidenceLinkController::class, 'destroy']);
    Route::post('deliverables/{deliverable}/apply-template', [DeliverableController::class, 'applyFlowTemplate']);
    Route::get('deliverables/{deliverable}/comments', [CommentController::class, 'index']);
    Route::post('deliverables/{deliverable}/comments', [CommentController::class, 'store']);

    // Usuarios — solo admin
    Route::apiResource('users', UserController::class)->middleware('role:admin');

    Route::get('reports/dashboard', [ReportController::class, 'dashboard']);
    Route::get('reports/compliance', [ReportController::class, 'compliance']);

    // Importación
    Route::post('/import/deliverables', [ImportController::class, 'deliverables']);
    Route::get('/import/template', [ImportController::class, 'template']);

    // Exportación
    Route::get('/export/deliverables', [ExportController::class, 'deliverables']);
    Route::get('/export/projects', [ExportController::class, 'projects']);

    // Flujo secuencial de entregable
    Route::get('deliverables/{deliverable}/flow', [DeliverableController::class, 'flow']);
});
