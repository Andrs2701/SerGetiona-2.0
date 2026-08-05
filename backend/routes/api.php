<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\CapacityController;
use App\Http\Controllers\Api\ChannelController;
use App\Http\Controllers\Api\ChannelMessageController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\ComplexityLevelController;
use App\Http\Controllers\Api\AcademicLevelController;
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
use App\Http\Controllers\Api\SystemConfigurationController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RoleCoverageController;
use App\Http\Controllers\Api\EvidenceLinkController;
use App\Http\Controllers\Api\ProductionLogController;
use App\Http\Controllers\Api\ResourceTypeController;
use App\Http\Controllers\Api\WorkspaceController;
use Illuminate\Support\Facades\Route;

// Públicas
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');

// Protegidas con Sanctum
Route::middleware(['auth:sanctum', 'throttle:90,1'])->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::put('/profile', [UserController::class, 'updateProfile']);
    Route::post('/profile/photo', [UserController::class, 'updatePhoto']);

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
    Route::get('/calendar/all-activities', [CalendarController::class, 'allActivities'])->middleware('permission:calendario,view_all');

    // Workspace personal
    Route::get('/my-workspace', [WorkspaceController::class, 'index']);

    // Proyectos (admin y coordinator pueden crear/eliminar)
    Route::get('projects', [ProjectController::class, 'index']);
    Route::get('projects/{project}', [ProjectController::class, 'show']);
    Route::get('projects/{project}/audit', [ProjectController::class, 'audit']);
    Route::post('projects', [ProjectController::class, 'store'])->middleware('permission:projects,manage');
    Route::put('projects/{project}', [ProjectController::class, 'update'])->middleware('permission:projects,manage');
    Route::delete('projects/{project}', [ProjectController::class, 'destroy'])->middleware('permission:projects,manage');

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
        ->except(['index', 'show'])->middleware('permission:entregables,manage');
    Route::put('activities/{activity}', [RoleActivityController::class, 'update']);
    Route::post('activities/{activity}/quick-action', [RoleActivityController::class, 'quickAction']);
    Route::get('activities/{activity}/timeline', [RoleActivityController::class, 'timeline']);
    Route::get('activities/{activity}/observations', [RoleActivityController::class, 'getObservations']);
    Route::post('activities/{activity}/observations', [RoleActivityController::class, 'addObservation']);
    Route::get('role-activities/{activity}/evidence', [EvidenceLinkController::class, 'byActivity']);

    // Evidence links
    Route::get('deliverables/{deliverable}/timeline', [DeliverableController::class, 'timeline']);
    Route::get('deliverables/{deliverable}/evidence', [EvidenceLinkController::class, 'byDeliverable']);
    Route::post('role-activities/{activity}/evidence', [EvidenceLinkController::class, 'store']);
    Route::delete('evidence/{link}', [EvidenceLinkController::class, 'destroy']);
    Route::post('deliverables/{deliverable}/apply-template', [DeliverableController::class, 'applyFlowTemplate'])->middleware('permission:entregables,manage');
    Route::get('deliverables/{deliverable}/comments', [CommentController::class, 'index']);
    Route::post('deliverables/{deliverable}/comments', [CommentController::class, 'store']);

    // Tipos de recurso por rol — lectura abierta, gestión solo admin
    Route::get('resource-types', [ResourceTypeController::class, 'index']);

    // Estados por rol — lectura abierta (Mi Espacio los necesita para cualquier rol), gestión solo admin
    Route::get('config/role-statuses', [SystemConfigurationController::class, 'getRoleStatuses']);
    Route::get('task-statuses', [SystemConfigurationController::class, 'getTaskStatusesForRole']);

    // Registros de producción por actividad
    Route::get('activities/{activity}/production', [ProductionLogController::class, 'byActivity']);
    Route::post('activities/{activity}/production', [ProductionLogController::class, 'store']);
    Route::delete('production-logs/{productionLog}', [ProductionLogController::class, 'destroy']);

    // Niveles de complejidad — lectura abierta (formularios), gestión solo admin
    Route::get('complexity-levels', [ComplexityLevelController::class, 'index']);
    // Niveles académicos (Pregrado/Posgrado/...) — lectura abierta, gestión solo admin
    Route::get('academic-levels', [AcademicLevelController::class, 'index']);
    Route::middleware('permission:configuracion,view')->group(function () {
        Route::post('complexity-levels', [ComplexityLevelController::class, 'store']);
        Route::put('complexity-levels/{level}', [ComplexityLevelController::class, 'update']);
        Route::delete('complexity-levels/{level}', [ComplexityLevelController::class, 'destroy']);

        Route::post('academic-levels', [AcademicLevelController::class, 'store']);
        Route::put('academic-levels/{level}', [AcademicLevelController::class, 'update']);
        Route::delete('academic-levels/{level}', [AcademicLevelController::class, 'destroy']);

        // Parámetros del sistema (salud, capacidad)
        Route::get('settings', [SystemSettingController::class, 'index']);
        Route::put('settings', [SystemSettingController::class, 'update']);

        // Configuración avanzada dinámica
        Route::get('config/roles', [SystemConfigurationController::class, 'getRoles']);
        Route::post('config/roles', [SystemConfigurationController::class, 'storeRole']);
        Route::put('config/roles/{slug}', [SystemConfigurationController::class, 'updateRole']);
        Route::delete('config/roles/{slug}', [SystemConfigurationController::class, 'destroyRole']);

        Route::get('config/permissions', [SystemConfigurationController::class, 'getPermissions']);
        Route::put('config/permissions', [SystemConfigurationController::class, 'updatePermissions']);

        Route::get('config/statuses', [SystemConfigurationController::class, 'getStatuses']);
        Route::post('config/statuses', [SystemConfigurationController::class, 'storeStatus']);
        Route::put('config/statuses/{id}', [SystemConfigurationController::class, 'updateStatus']);
        Route::delete('config/statuses/{id}', [SystemConfigurationController::class, 'destroyStatus']);

        Route::post('config/role-statuses', [SystemConfigurationController::class, 'storeRoleStatus']);
        Route::put('config/role-statuses/{id}', [SystemConfigurationController::class, 'updateRoleStatus']);
        Route::delete('config/role-statuses/{id}', [SystemConfigurationController::class, 'destroyRoleStatus']);
        Route::post('config/role-statuses/reorder', [SystemConfigurationController::class, 'reorderRoleStatuses']);

        Route::get('config/transitions', [SystemConfigurationController::class, 'getTransitions']);
        Route::post('config/transitions', [SystemConfigurationController::class, 'storeTransition']);
        Route::delete('config/transitions/{id}', [SystemConfigurationController::class, 'destroyTransition']);

        Route::get('config/visibility-rules', [SystemConfigurationController::class, 'getVisibilityRules']);
        Route::put('config/visibility-rules', [SystemConfigurationController::class, 'updateVisibilityRules']);

        // Tipos de recurso — CRUD admin
        Route::post('resource-types', [ResourceTypeController::class, 'store']);
        Route::put('resource-types/{resourceType}', [ResourceTypeController::class, 'update']);
        Route::delete('resource-types/{resourceType}', [ResourceTypeController::class, 'destroy']);
    });

    // Lista liviana para elegir responsables (id/nombre/rol) — abierta a
    // cualquier autenticado. Debe ir antes del apiResource de abajo para que
    // "assignable" no se intente resolver como {user} en GET /users/{user}.
    Route::get('/users/assignable', [UserController::class, 'assignable']);

    // Usuarios: lectura para gestión de asignaciones; escritura solo admin.
    Route::apiResource('users', UserController::class)->only(['index', 'show'])
        ->middleware('permission:users,view');
    Route::apiResource('users', UserController::class)->except(['index', 'show'])
        ->middleware('permission:users,manage');
    Route::post('/users/{user}/reset-link', [UserController::class, 'generateResetLink'])
        ->middleware('permission:users,manage');

    // Cobertura temporal de rol (vacaciones/incapacidades) — admin/coordinador
    Route::middleware('role:admin,coordinator')->group(function () {
        Route::get('/users/{user}/role-coverages', [RoleCoverageController::class, 'index']);
        Route::post('/role-coverages', [RoleCoverageController::class, 'store']);
        Route::delete('/role-coverages/{roleCoverage}', [RoleCoverageController::class, 'destroy']);
    });

    // Reportes — módulo "reportes" de la Matriz de Permisos.
    Route::middleware('permission:reportes,view')->group(function () {
        Route::get('reports/health', [HealthController::class, 'portfolio']);
        Route::get('reports/executive-summary', [ReportController::class, 'executiveSummary']);
        Route::get('reports/dashboard', [ReportController::class, 'dashboard']);
        Route::get('reports/compliance', [ReportController::class, 'compliance']);
        Route::get('reports/workload', [ReportController::class, 'workload']);
        Route::get('reports/overdue-list', [ReportController::class, 'overdueList']);
        Route::get('reports/approaching-list', [ReportController::class, 'approachingList']);
        Route::get('reports/production', [ProductionLogController::class, 'summary']);
    });

    // Capacidad, decisiones, importación y exportación — información gerencial
    // sin permiso propio en la Matriz todavía; siguen fijas a admin/coordinator.
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

        // Salud de proyectos (vista de detalle de un proyecto puntual)
        Route::get('projects/{project}/health', [HealthController::class, 'project']);

        Route::post('/import/deliverables', [ImportController::class, 'deliverables'])->middleware('throttle:10,1');
        Route::get('/import/template', [ImportController::class, 'template']);

        Route::get('/export/deliverables', [ExportController::class, 'deliverables'])->middleware('throttle:10,1');
        Route::get('/export/production', [ProductionLogController::class, 'export'])->middleware('throttle:10,1');
    });

    // Exportar Escuelas/Proyectos — mismo permiso que crear/editar/eliminar
    // uno (projects.manage), en vez de admin/coordinator fijo, para que el
    // botón "Exportar" del listado siga la Matriz igual que "Nueva Escuela / Proyecto".
    Route::get('/export/projects', [ExportController::class, 'projects'])
        ->middleware(['permission:projects,manage', 'throttle:10,1']);

    // Flujo secuencial de entregable
    Route::get('deliverables/{deliverable}/flow', [DeliverableController::class, 'flow']);

    // Preferencias de usuario
    Route::get('preferences', [PreferenceController::class, 'show']);
    Route::put('preferences', [PreferenceController::class, 'update']);

    // Canales de colaboración (todos los roles autenticados)
    Route::get('channels', [ChannelController::class, 'index']);
    Route::get('channels/{channel}', [ChannelController::class, 'show']);
    Route::get('channels/{channel}/members', [ChannelController::class, 'members']);
    Route::post('channels/{channel}/join', [ChannelController::class, 'join']);
    Route::post('channels/{channel}/read', [ChannelController::class, 'markRead']);
    Route::get('channels/{channel}/messages', [ChannelMessageController::class, 'index']);
    Route::post('channels/{channel}/messages', [ChannelMessageController::class, 'store']);
    Route::delete('channels/{channel}/messages/{message}', [ChannelMessageController::class, 'destroy']);

    // Decisiones asignables (accesible a todos los roles autenticados)
    Route::put('/decisions/{decision}/status', [DecisionRecordController::class, 'updateStatus']);
    Route::get('/calendar/my-decisions', [CalendarController::class, 'myDecisions']);

    // Administración de canales: gobernado por la Matriz de Permisos (colaboracion.manage_channels)
    Route::middleware('permission:colaboracion,manage_channels')->group(function () {
        Route::post('channels', [ChannelController::class, 'store']);
        Route::put('channels/{channel}', [ChannelController::class, 'update']);
        Route::delete('channels/{channel}', [ChannelController::class, 'destroy']);
        Route::post('channels/{channel}/members', [ChannelController::class, 'addMember']);
        Route::delete('channels/{channel}/members/{user}', [ChannelController::class, 'removeMember']);
    });
});
