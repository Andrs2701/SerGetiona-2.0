<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CapacityController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\ChannelMessageController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\ComplexityLevelController;
use App\Http\Controllers\Api\DecisionRecordController;
use App\Http\Controllers\Api\DeliverableController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PreferenceController;
use App\Http\Controllers\Api\ProgramController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleActivityController;
use App\Http\Controllers\Api\SubjectController;
use App\Http\Controllers\Api\SystemSettingController;
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
    Route::get('/calendar/all-activities', [CalendarController::class, 'allActivities'])->middleware('role:admin,coordinator');

    // Workspace personal
    Route::get('/my-workspace', [WorkspaceController::class, 'index']);

    // Proyectos (admin y coordinator pueden crear/eliminar)
    Route::get('projects', [ProjectController::class, 'index']);
    Route::get('projects/{project}', [ProjectController::class, 'show']);
    Route::post('projects', [ProjectController::class, 'store'])->middleware('role:admin,coordinator');
    Route::put('projects/{project}', [ProjectController::class, 'update'])->middleware('role:admin,coordinator');
    Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->middleware('role:admin,coordinator');

    // Lectura abierta a autenticados (los controladores filtran por rol);
    // escritura solo gerencial
    Route::apiResource('programs', ProgramController::class)->only(['index', 'show']);
    Route::apiResource('programs', ProgramController::class)
        ->except(['index', 'show'])->middleware('role:admin,coordinator');
    Route::apiResource('subjects', SubjectController::class)->only(['index', 'show']);
    Route::apiResource('subjects', SubjectController::class)
        ->except(['index', 'show'])->middleware('role:admin,coordinator');
    Route::apiResource('deliverables', DeliverableController::class)->only(['index', 'show']);
    Route::apiResource('deliverables', DeliverableController::class)
        ->except(['index', 'show'])->middleware('role:admin,coordinator');
    Route::put('activities/{activity}', [RoleActivityController::class, 'update']);
    Route::post('activities/{activity}/quick-action', [RoleActivityController::class, 'quickAction']);
    Route::get('activities/{activity}/timeline', [RoleActivityController::class, 'timeline']);
    Route::get('role-activities/{activity}/evidence', [EvidenceLinkController::class, 'byActivity']);

    // Evidence links
    Route::get('deliverables/{deliverable}/evidence', [EvidenceLinkController::class, 'byDeliverable']);
    Route::post('role-activities/{activity}/evidence', [EvidenceLinkController::class, 'store']);
    Route::delete('evidence/{link}', [EvidenceLinkController::class, 'destroy']);
    Route::post('deliverables/{deliverable}/apply-template', [DeliverableController::class, 'applyFlowTemplate'])->middleware('role:admin,coordinator');
    Route::get('deliverables/{deliverable}/comments', [CommentController::class, 'index']);
    Route::post('deliverables/{deliverable}/comments', [CommentController::class, 'store']);

    // Niveles de complejidad — lectura abierta (formularios), gestión solo admin
    Route::get('complexity-levels', [ComplexityLevelController::class, 'index']);
    Route::middleware('role:admin')->group(function () {
        Route::post('complexity-levels', [ComplexityLevelController::class, 'store']);
        Route::put('complexity-levels/{level}', [ComplexityLevelController::class, 'update']);
        Route::delete('complexity-levels/{level}', [ComplexityLevelController::class, 'destroy']);

        // Parámetros del sistema (salud, capacidad)
        Route::get('settings', [SystemSettingController::class, 'index']);
        Route::put('settings', [SystemSettingController::class, 'update']);
    });

    // Usuarios — solo admin
    Route::apiResource('users', UserController::class)->middleware('role:admin');

    // Reportes, importación y exportación — información gerencial
    Route::middleware('role:admin,coordinator')->group(function () {
        // Capacidad operativa
        Route::get('capacity', [CapacityController::class, 'index']);
        Route::get('capacity/by-role', [CapacityController::class, 'byRole']);
        Route::get('capacity/trends', [CapacityController::class, 'trends']);
        Route::get('capacity/users/{user}/activities', [CapacityController::class, 'userActivities']);
        Route::get('activities/{activity}/reassignment-suggestions', [CapacityController::class, 'suggestions']);

        // Registro de decisiones
        Route::apiResource('decisions', DecisionRecordController::class)
            ->parameters(['decisions' => 'decision']);

        // Salud de proyectos y resumen ejecutivo
        Route::get('reports/health', [HealthController::class, 'portfolio']);
        Route::get('projects/{project}/health', [HealthController::class, 'project']);
        Route::get('reports/executive-summary', [ReportController::class, 'executiveSummary']);

        Route::get('reports/dashboard', [ReportController::class, 'dashboard']);
        Route::get('reports/compliance', [ReportController::class, 'compliance']);
        Route::get('reports/workload', [ReportController::class, 'workload']);

        Route::post('/import/deliverables', [ImportController::class, 'deliverables']);
        Route::get('/import/template', [ImportController::class, 'template']);

        Route::get('/export/deliverables', [ExportController::class, 'deliverables']);
        Route::get('/export/projects', [ExportController::class, 'projects']);
    });

    // Flujo secuencial de entregable
    Route::get('deliverables/{deliverable}/flow', [DeliverableController::class, 'flow']);

    // Preferencias de usuario
    Route::get('preferences', [PreferenceController::class, 'show']);
    Route::put('preferences', [PreferenceController::class, 'update']);

    // Canales de colaboración (todos los roles autenticados)
    Route::get('channels', [ChannelController::class, 'index']);
    Route::get('channels/{channel}', [ChannelController::class, 'show']);
    Route::post('channels/{channel}/join', [ChannelController::class, 'join']);
    Route::post('channels/{channel}/read', [ChannelController::class, 'markRead']);
    Route::get('channels/{channel}/messages', [ChannelMessageController::class, 'index']);
    Route::post('channels/{channel}/messages', [ChannelMessageController::class, 'store']);
    Route::delete('channels/{channel}/messages/{message}', [ChannelMessageController::class, 'destroy']);

    // Solo admin/coordinator pueden crear canales
    Route::middleware('role:admin,coordinator')->group(function () {
        Route::post('channels', [ChannelController::class, 'store']);
    });
});
