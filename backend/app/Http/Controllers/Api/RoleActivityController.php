<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ResourceType;
use App\Models\RoleActivity;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RoleActivityController extends Controller
{
    private const ROLE_CHAIN = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

    /**
     * Solo admin/coordinator, el responsable de la actividad o — para acciones
     * de revisión — el responsable del rol siguiente en la cadena (quien valida
     * la entrega del rol anterior) pueden operar sobre la actividad.
     */
    private function authorizeActivity(Request $request, RoleActivity $activity, bool $allowChainReviewer = false): ?\Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        if (in_array($user->role, ['admin', 'coordinator'])) {
            return null;
        }

        if ((int)$activity->responsible_id === (int)$user->id) {
            return null;
        }

        if ($allowChainReviewer) {
            $currentIdx = array_search($activity->role, self::ROLE_CHAIN);
            if ($currentIdx !== false && $currentIdx < count(self::ROLE_CHAIN) - 1) {
                $reviewerRole = self::ROLE_CHAIN[$currentIdx + 1];
                $isReviewer = $activity->deliverable?->roleActivities()
                    ->where('role', $reviewerRole)
                    ->where('responsible_id', $user->id)
                    ->exists();
                if ($isReviewer) {
                    return null;
                }
            }
        }

        return response()->json(['message' => 'No tienes permiso para realizar esta acción.'], 403);
    }

    /**
     * Al pasar una actividad a delivered/approved, habilita la actividad del
     * siguiente rol de la cadena (not_started/pending → in_progress) y notifica
     * a su responsable. Devuelve la siguiente actividad o null si no aplica.
     */
    private function advanceChain(RoleActivity $activity): ?RoleActivity
    {
        if (!in_array($activity->status, ['delivered', 'approved'], true)) {
            return null;
        }

        $currentIdx = array_search($activity->role, self::ROLE_CHAIN);
        if ($currentIdx === false || $currentIdx >= count(self::ROLE_CHAIN) - 1) {
            return null;
        }

        // Carga todas las actividades del entregable de una sola vez para iterar sin N+1
        $allActivities = $activity->deliverable?->roleActivities()
            ->with('responsible')
            ->get()
            ->keyBy('role');

        $deliverableName = $activity->deliverable?->name ?? "entregable #{$activity->deliverable_id}";
        $currentLabel    = NotificationService::translateRole($activity->role);
        $verb            = $activity->status === 'delivered' ? 'entregó' : 'aprobó';

        // Recorre el resto de la cadena saltando roles 'not_applicable'
        for ($i = $currentIdx + 1; $i < count(self::ROLE_CHAIN); $i++) {
            $nextRole     = self::ROLE_CHAIN[$i];
            $nextActivity = $allActivities[$nextRole] ?? null;

            if (!$nextActivity) {
                continue;
            }

            if ($nextActivity->status === 'not_applicable') {
                continue; // rol sin responsable, saltar automáticamente
            }

            // Primer rol aplicable encontrado: activar si está en estado inicial
            if (in_array($nextActivity->status, ['not_started', 'pending'], true)) {
                $oldNextStatus        = $nextActivity->status;
                $nextActivity->status = 'in_progress';
                $nextActivity->save();

                AuditLog::create([
                    'user_id'      => Auth::id() ?? 1,
                    'action'       => 'updated',
                    'entity_type'  => 'RoleActivity',
                    'entity_id'    => $nextActivity->id,
                    'field_changed'=> 'status',
                    'old_value'    => $oldNextStatus,
                    'new_value'    => 'in_progress',
                    'ip_address'   => request()->ip(),
                    'created_at'   => now(),
                ]);
            }

            if ($nextActivity->responsible) {
                $nextLabel = NotificationService::translateRole($nextRole);
                NotificationService::notify(
                    $nextActivity->responsible,
                    'next_in_chain',
                    'Tu turno en el flujo',
                    "El rol '{$currentLabel}' {$verb} su actividad en '{$deliverableName}'. Tu rol '{$nextLabel}' es el siguiente en el flujo.",
                    ['entity_type' => 'RoleActivity', 'entity_id' => $nextActivity->id]
                );
            }

            return $nextActivity;
        }

        return null;
    }

    public static function translateStatus(string $status): string
    {
        return match($status) {
            'not_started'           => 'Sin Iniciar',
            'draft'                 => 'Borrador',
            'in_development'        => 'En Desarrollo',
            'delivered'             => 'Entregado',
            'adjustments_requested' => 'Ajustes Solicitados',
            'approved'              => 'Aprobado',
            'not_applicable'        => 'No Aplica',
            'in_progress'           => 'En Progreso',
            'in_review'             => 'En Revisión',
            'adjusting'             => 'Ajustando',
            'designing'             => 'Diseñando',
            'production'            => 'Producción',
            'editing'               => 'Edición',
            'implementing'          => 'Implementando',
            'validating'            => 'Validando',
            'pending'               => 'Pendiente',
            'in_testing'            => 'En Pruebas',
            'with_findings'         => 'Con Hallazgos',
            default                 => $status,
        };
    }

    /**
     * Build the enriched data payload for status_changed notifications.
     * Requires 'deliverable.subject.academicProgram' to be loaded on $activity.
     */
    private function buildStatusNotificationData(RoleActivity $activity): array
    {
        $activity->loadMissing('deliverable.subject.academicProgram.project', 'responsible');
        $deliverable = $activity->deliverable;
        $subject     = $deliverable?->subject;
        $program     = $subject?->academicProgram;
        $project     = $program?->project;

        return [
            'entity_type'          => 'RoleActivity',
            'entity_id'            => $activity->id,
            'activity_id'          => $activity->id,
            'role_activity_id'     => $activity->id,
            'deliverable_id'       => $activity->deliverable_id,
            'deliverable_name'     => $deliverable?->name,
            'role'                 => $activity->role,
            'status'               => $activity->status,
            'new_status'           => $activity->status,
            'commitment_date'      => $activity->commitment_date?->toDateString(),
            'actual_delivery_date' => $activity->actual_delivery_date?->toDateString(),
            'subject'              => $subject?->name,
            'program'              => $program?->name,
            'project'              => $project?->name,
            'responsible_name'     => $activity->responsible?->name,
        ];
    }

    public function update(Request $request, RoleActivity $activity)
    {
        if ($denied = $this->authorizeActivity($request, $activity)) {
            return $denied;
        }

        $isManager = in_array($request->user()->role, ['admin', 'coordinator'], true);
        $data = $request->validate([
            'responsible_id'       => 'nullable|exists:users,id',
            'assigned_at'          => 'nullable|date',
            'commitment_date'      => 'nullable|date',
            'actual_start_date'    => 'nullable|date',
            'actual_delivery_date' => 'nullable|date',
            'status'                     => 'nullable|string',
            'notes'                      => 'nullable|string',
            'production_not_applicable'  => 'sometimes|boolean',
            'adjust_roles'               => 'nullable|array',
            'adjust_roles.*'             => 'string',
        ]);

        $activityId = $activity->id;

        return DB::transaction(function () use ($request, $activityId, $data, $isManager) {
            // Releer bajo lock: la instancia de route-model-binding puede estar
            // obsoleta si otro request modificó esta misma fila mientras tanto.
            $activity = RoleActivity::where('id', $activityId)->lockForUpdate()->firstOrFail();

            if (!$isManager) {
                // QA puede aprobar directamente (es su función), los demás roles no
                $isQaRole = $activity->role === 'qa';

                if (!$isQaRole) {
                    abort_if(
                        in_array($activity->status, ['delivered', 'approved'], true),
                        403,
                        'Esta actividad ya ha sido entregada o aprobada y no puede ser modificada (puede que otro usuario ya la haya actualizado).'
                    );
                }

                $forbiddenFields = array_intersect(
                    array_keys($data),
                    ['responsible_id', 'assigned_at', 'commitment_date']
                );
                abort_if(
                    $forbiddenFields !== [],
                    403,
                    'Solo administradores y coordinadores pueden reasignar o cambiar fechas comprometidas.'
                );
                abort_if(
                    ($data['status'] ?? null) === 'approved' && !$isQaRole,
                    403,
                    'No puedes aprobar tu propia actividad.'
                );
            }

            if (isset($data['status'])) {
                $statusObj = \App\Models\SystemStatus::where('type', 'task')
                    ->where('slug', $data['status'])
                    ->where('is_active', true)
                    ->first();

                if (!$statusObj) {
                    return response()->json(['message' => 'El estado de actividad no es válido o está inactivo.'], 422);
                }

                // No se valida contra system_statuses.allowed_roles: quién ve qué
                // estado lo decide role_statuses (lo que administra "Estados por
                // Rol"), y validar aquí contra un catálogo distinto haría que el
                // selector ofreciera opciones que al guardar dan 422.
                //
                // El chequeo de abajo es deliberadamente fail-open: si no hay fila
                // en role_statuses para este par (rol, estado), se permite.
                // role_statuses es configuración de presentación, no una frontera
                // de seguridad — hay pares en uso real sin configurar, y borrar una
                // fila desde la pantalla no debe romper la automatización de QA.
                $roleStatus = \App\Models\RoleStatus::where('role', $activity->role)
                    ->where('status_slug', $data['status'])
                    ->first();

                if ($roleStatus && $roleStatus->is_automatic && !$isManager) {
                    $isQaRole = $activity->role === 'qa';
                    if (!($data['status'] === 'approved' && $isQaRole)) {
                        return response()->json(['message' => "No tienes permisos para asignar el estado '{$statusObj->label}' ya que es un estado automático."], 403);
                    }
                }

                if (in_array($data['status'], ['delivered', 'approved'], true)) {
                    if (empty($data['actual_delivery_date'])) {
                        $data['actual_delivery_date'] = Carbon::today()->toDateString();
                    }
                } elseif (!in_array($data['status'], ['adjustments_requested', 'with_findings'], true)) {
                    // Devolver con hallazgos significa "ya entregó, hay que
                    // corregir" — no "nunca entregó". Borrar la fecha aquí
                    // hacía que la actividad se viera "vencida" (todo cálculo
                    // de vencida exige actual_delivery_date en null) y que la
                    // fecha real de entrega desapareciera de la interfaz.
                    $data['actual_delivery_date'] = null;
                }
            }

            // Extraer adjust_roles antes de actualizar el modelo (no es columna de la tabla)
            $adjustRoles = $data['adjust_roles'] ?? [];
            unset($data['adjust_roles']);

            $activity->update($data);
            $dirty = $activity->getChanges();

            $activity->loadMissing('deliverable.subject.academicProgram');
            $deliverableName = $activity->deliverable?->name ?? "entregable #{$activity->deliverable_id}";

            if (isset($dirty['status'])) {
                // Caso A: QA aprueba la actividad -> Aprobar entregable completo y roles hermanos
                if ($activity->role === 'qa' && $activity->status === 'approved') {
                    $deliverable = $activity->deliverable;
                    if ($deliverable) {
                        $deliverable->global_status = 'finished';
                        $deliverable->save();

                        $deliverable->roleActivities()
                            ->whereIn('status', ['delivered', 'in_review'])
                            ->update(['status' => 'approved']);
                    }
                }

                // Caso B: QA o Admin devuelven actividades específicas a ajustes
                if ($activity->role === 'qa' && in_array($activity->status, ['adjustments_requested', 'with_findings'], true)) {
                    if (!empty($adjustRoles) && $activity->deliverable) {
                        $siblingActivities = $activity->deliverable->roleActivities()
                            ->whereIn('role', $adjustRoles)
                            ->where('status', '!=', 'not_applicable')
                            ->lockForUpdate()
                            ->get();

                        foreach ($siblingActivities as $sibling) {
                            $oldSiblingStatus = $sibling->status;
                            $sibling->status = 'adjustments_requested';
                            // Ya entregó — no se borra su fecha de entrega
                            // (ver comentario equivalente más arriba en update()).
                            $sibling->save();

                            \App\Models\AuditLog::create([
                                'user_id'       => Auth::id() ?? 1,
                                'action'        => 'updated',
                                'entity_type'   => 'RoleActivity',
                                'entity_id'     => $sibling->id,
                                'field_changed' => 'status',
                                'old_value'     => $oldSiblingStatus,
                                'new_value'     => 'adjustments_requested',
                                'ip_address'    => $request->ip(),
                                'created_at'    => now(),
                            ]);

                            if ($sibling->responsible) {
                                $roleLabel = NotificationService::translateRole($sibling->role);
                                NotificationService::notify(
                                    $sibling->responsible,
                                    'status_changed',
                                    "Tu actividad requiere ajustes: {$deliverableName}",
                                    "Tu actividad de '{$roleLabel}' fue devuelta a Ajustes Solicitados por Calidad (QA). Observaciones de QA: " . ($activity->notes ?? 'Sin observaciones específicas.'),
                                    ['entity_type' => 'RoleActivity', 'entity_id' => $sibling->id]
                                );
                            }
                        }
                    }
                }
            }

            // Notification: task assigned (new responsible)
            if (isset($dirty['responsible_id']) && $activity->responsible_id) {
                $newResponsible = User::find($activity->responsible_id);
                if ($newResponsible) {
                    NotificationService::notifyTaskAssigned($activity, $newResponsible);
                }
            }

            // Notification: status changed — notify coordinators/admin AND responsible
            if (isset($dirty['status'])) {
                $newLabel    = self::translateStatus($activity->status);
                $roleLabel   = NotificationService::translateRole($activity->role);
                $managers    = User::whereIn('role', ['admin', 'coordinator'])->get();
                $statusData  = $this->buildStatusNotificationData($activity);

                $verb = match ($activity->status) {
                    'delivered'             => 'entregó',
                    'approved'              => 'aprobó',
                    'adjustments_requested' => 'solicitó ajustes para',
                    'with_findings'         => 'marcó con hallazgos',
                    default                 => "cambió a {$newLabel}",
                };

                $notifTitle = "{$roleLabel} {$verb}: {$deliverableName}";

                $respName = $statusData['responsible_name'] ?? 'Sin asignar';
                $progName = $statusData['program'] ?? '—';
                $subjName = $statusData['subject'] ?? '—';
                $notifBody = "Responsable: {$respName} | Programa: {$progName} | Asignatura: {$subjName}";

                NotificationService::notifyMany($managers, 'status_changed', $notifTitle, $notifBody, $statusData);

                // Notify the responsible if change was made by a manager
                if ($isManager && $activity->responsible_id) {
                    $responsible = User::find($activity->responsible_id);
                    if ($responsible && !$managers->contains('id', $responsible->id)) {
                        NotificationService::notify(
                            $responsible,
                            'status_changed',
                            "Estado de tu actividad actualizado: {$deliverableName}",
                            "Tu actividad '{$roleLabel}' {$verb}. {$notifBody}",
                            $statusData
                        );
                    }
                }

                // Habilita y notifica al siguiente rol de la cadena (delivered/approved)
                $this->advanceChain($activity);
            }

            // Notification: commitment date changed → notify responsible
            if (isset($dirty['commitment_date']) && $activity->responsible_id) {
                $responsible = User::find($activity->responsible_id);
                if ($responsible) {
                    NotificationService::notify(
                        $responsible,
                        'date_changed',
                        'Fecha de compromiso actualizada',
                        "La fecha límite de tu actividad '{$activity->role}' en '{$deliverableName}' fue actualizada a {$activity->commitment_date}.",
                        ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id]
                    );
                }
            }

            // Notification: any other modification by a manager → notify responsible
            if ($isManager && $activity->responsible_id && !empty($dirty)) {
                $changedFields = array_keys(array_diff_key($dirty, ['updated_at' => true, 'status' => true,
                    'responsible_id' => true, 'commitment_date' => true]));
                if (!empty($changedFields)) {
                    $responsible = User::find($activity->responsible_id);
                    if ($responsible) {
                        NotificationService::notify(
                            $responsible,
                            'activity_modified',
                            'Tu actividad fue modificada',
                            "Se realizaron cambios en tu actividad '{$activity->role}' del entregable '{$deliverableName}'.",
                            ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id]
                        );
                    }
                }
            }

            if ($activity->deliverable) {
                self::recalculateGlobalStatus($activity->deliverable);
            }

            return response()->json($activity->load('responsible', 'assignedBy'));
        }, 3);
    }

    /**
     * POST /api/activities/{activity}/quick-action
     * body: { action: 'deliver'|'approve'|'request_adjustments'|'reject' }
     */
    public function quickAction(Request $request, RoleActivity $activity)
    {
        if ($denied = $this->authorizeActivity($request, $activity, allowChainReviewer: true)) {
            return $denied;
        }

        $data = $request->validate([
            'action' => 'required|in:deliver,approve,request_adjustments,reject',
        ]);

        $action  = $data['action'];
        $user = $request->user();
        $isManager = in_array($user->role, ['admin', 'coordinator'], true);
        $isOwner = (int)$activity->responsible_id === (int)$user->id;

        if ($action === 'deliver' && !$isManager && !$isOwner) {
            abort(403, 'Solo el responsable puede entregar esta actividad.');
        }

        if ($action !== 'deliver' && !$isManager && $isOwner) {
            abort(403, 'El responsable no puede revisar ni aprobar su propia actividad.');
        }

        $activityId = $activity->id;

        return DB::transaction(function () use ($request, $activityId, $action) {
            // Releer bajo lock: evita perder escrituras o duplicar notificaciones
            // si dos requests ejecutan una quick-action sobre la misma fila a la vez.
            $activity = RoleActivity::where('id', $activityId)->lockForUpdate()->firstOrFail();

            $today   = Carbon::today()->toDateString();
            $oldStatus = $activity->status;

            switch ($action) {
                case 'deliver':
                    $hasResourceTypes = ResourceType::where('role', $activity->role)->where('is_active', true)->exists();
                    if ($hasResourceTypes && $activity->productionLogs()->count() === 0) {
                        return response()->json([
                            'message' => 'Debes registrar al menos un recurso producido antes de marcar como entregado.',
                            'requires_production' => true,
                        ], 422);
                    }
                    $activity->status               = 'delivered';
                    $activity->actual_delivery_date = $today;
                    break;

                case 'approve':
                    $activity->status               = 'approved';
                    $activity->actual_delivery_date = $activity->actual_delivery_date ?? $today;
                    break;

                case 'request_adjustments':
                    $activity->status = 'adjustments_requested';
                    break;

                case 'reject':
                    $activity->status = 'with_findings';
                    break;
            }

            $activity->save();

            if (!$activity->wasChanged('status')) {
                // Otro request concurrente ya dejó la actividad en este mismo estado
                // (p. ej. doble clic, o dos usuarios aprobando a la vez): no-op seguro,
                // sin repetir auditoría, notificaciones ni avance de cadena.
                $activity->load('responsible', 'assignedBy', 'deliverable');
                return response()->json([
                    'activity'             => $activity,
                    'next_role'            => null,
                    'next_responsible'     => null,
                    'next_commitment_date' => null,
                ]);
            }

            if ($action === 'request_adjustments') {
                // Notificar al experto del entregable
                $expertActivity = $activity->deliverable?->roleActivities()
                    ->where('role', 'expert')
                    ->first();
                if ($expertActivity?->responsible_id) {
                    $expertUser = User::find($expertActivity->responsible_id);
                    if ($expertUser) {
                        NotificationService::notify(
                            $expertUser,
                            'adjustments_requested',
                            'Ajustes solicitados',
                            "Se han solicitado ajustes en el entregable '{$activity->deliverable?->name}'.",
                            ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id]
                        );
                    }
                }
            }

            // Audit log
            AuditLog::create([
                'user_id'       => Auth::id(),
                'action'        => 'quick_action',
                'entity_type'   => 'RoleActivity',
                'entity_id'     => $activity->id,
                'field_changed' => 'status',
                'old_value'     => $oldStatus,
                'new_value'     => $activity->status,
                'ip_address'    => $request->ip(),
                'created_at'    => now(),
            ]);

            // Notify admins + coordinators
            $activity->loadMissing('deliverable.subject.academicProgram');
            $managers = User::whereIn('role', ['admin', 'coordinator'])->get();
            $newLabel = self::translateStatus($activity->status);
            $roleLabel = NotificationService::translateRole($activity->role);
            $delName  = $activity->deliverable?->name ?? "entregable #{$activity->deliverable_id}";
            $statusData = $this->buildStatusNotificationData($activity);

            $verb = match ($activity->status) {
                'delivered'             => 'entregó',
                'approved'              => 'aprobó',
                'adjustments_requested' => 'solicitó ajustes para',
                'with_findings'         => 'marcó con hallazgos',
                default                 => "cambió a {$newLabel}",
            };

            $notifTitle = "{$roleLabel} {$verb}: {$delName}";

            $respName = $statusData['responsible_name'] ?? 'Sin asignar';
            $progName = $statusData['program'] ?? '—';
            $subjName = $statusData['subject'] ?? '—';
            $notifBody = "Responsable: {$respName} | Programa: {$progName} | Asignatura: {$subjName}";

            NotificationService::notifyMany(
                $managers,
                'status_changed',
                $notifTitle,
                $notifBody,
                $statusData
            );

            // Notify the activity owner (if different from who triggered the action)
            if ($activity->responsible_id && (int)$activity->responsible_id !== (int)Auth::id()) {
                $owner = User::find($activity->responsible_id);
                if ($owner && !$managers->contains('id', $owner->id)) {
                    NotificationService::notify(
                        $owner,
                        'status_changed',
                        "Estado de tu actividad actualizado: {$delName}",
                        "Tu actividad '{$roleLabel}' {$verb}. {$notifBody}",
                        $statusData
                    );
                }
            }

            // Habilita y notifica al siguiente rol de la cadena (delivered/approved)
            $nextActivity       = $this->advanceChain($activity);
            $nextRole           = $nextActivity?->role;
            $nextResponsible    = $nextActivity?->responsible?->name;
            $nextCommitmentDate = $nextActivity?->commitment_date?->toDateString();

            if ($activity->deliverable) {
                self::recalculateGlobalStatus($activity->deliverable);
            }

            $activity->load('responsible', 'assignedBy', 'deliverable');

            return response()->json([
                'activity'             => $activity,
                'next_role'            => $nextRole,
                'next_responsible'     => $nextResponsible,
                'next_commitment_date' => $nextCommitmentDate,
            ]);
        }, 3);
    }

    /**
     * GET /api/activities/{activity}/timeline
     * Timeline de cambios de estado, fechas y notas para una actividad.
     */
    public function timeline(Request $request, RoleActivity $activity)
    {
        abort_unless(
            \App\Support\ResourceAccess::canAccessActivity($request->user(), $activity),
            403
        );

        $logs = AuditLog::where('entity_type', 'RoleActivity')
            ->where('entity_id', $activity->id)
            ->with('user')
            ->orderBy('created_at', 'asc')
            ->get();

        $events = [];

        // Evento de creación
        $events[] = [
            'type'  => 'created',
            'icon'  => 'plus',
            'label' => 'Actividad creada',
            'user'  => null,
            'date'  => $activity->created_at?->toIso8601String(),
        ];

        // Observaciones: se leen de su propia tabla, que es la fuente de verdad
        // del historial. Antes esta rama vivía de audit_logs con
        // field_changed='notes', que nadie escribía nunca — código muerto.
        foreach ($activity->observations()->with('user')->get() as $obs) {
            $events[] = [
                'type'  => 'note',
                'icon'  => 'message',
                'label' => 'Observación: ' . \Illuminate\Support\Str::limit($obs->observation, 80),
                'user'  => $obs->user?->name,
                'date'  => $obs->created_at?->toIso8601String(),
            ];
        }

        // Si tiene responsable asignado, evento de asignación
        if ($activity->responsible_id && $activity->assigned_at) {
            $events[] = [
                'type'  => 'assigned',
                'icon'  => 'user',
                'label' => 'Asignada a ' . ($activity->responsible?->name ?? 'responsable'),
                'user'  => null,
                'date'  => Carbon::parse($activity->assigned_at)->toIso8601String(),
            ];
        }

        // Eventos del audit log
        foreach ($logs as $log) {
            if ($log->field_changed === 'status' && $log->new_value) {
                $oldLabel = self::translateStatus($log->old_value ?? '');
                $newLabel = self::translateStatus($log->new_value);
                $events[] = [
                    'type'  => 'status',
                    'icon'  => 'refresh',
                    'label' => "Estado: {$oldLabel} → {$newLabel}",
                    'user'  => $log->user?->name,
                    'date'  => $log->created_at?->toIso8601String(),
                ];
            } elseif ($log->field_changed === 'actual_delivery_date' && $log->new_value) {
                $events[] = [
                    'type'  => 'delivered',
                    'icon'  => 'send',
                    'label' => 'Entrega registrada',
                    'user'  => $log->user?->name,
                    'date'  => $log->created_at?->toIso8601String(),
                ];
            } elseif ($log->field_changed === 'commitment_date' && $log->new_value) {
                $events[] = [
                    'type'  => 'date_changed',
                    'icon'  => 'calendar',
                    'label' => "Fecha límite → {$log->new_value}",
                    'user'  => $log->user?->name,
                    'date'  => $log->created_at?->toIso8601String(),
                ];
            } elseif ($log->field_changed === 'evidence_link' && $log->new_value) {
                $events[] = [
                    'type'  => 'delivered',
                    'icon'  => 'link',
                    'label' => "Evidencia agregada: {$log->new_value}",
                    'user'  => $log->user?->name,
                    'date'  => $log->created_at?->toIso8601String(),
                ];
            }
        }

        // Si está aprobado y tiene fecha de entrega real
        if ($activity->status === 'approved' && $activity->actual_delivery_date) {
            $onTime = $activity->commitment_date
                && $activity->actual_delivery_date->lte(Carbon::parse($activity->commitment_date));
            $events[] = [
                'type'  => 'approved',
                'icon'  => 'check',
                'label' => $onTime ? 'Aprobada ✓ (a tiempo)' : 'Aprobada (fuera de tiempo)',
                'user'  => null,
                'date'  => $activity->updated_at?->toIso8601String(),
            ];
        }

        // Ordenar por fecha
        usort($events, fn($a, $b) => strcmp($a['date'] ?? '', $b['date'] ?? ''));

        return response()->json(['events' => $events]);
    }

    public static function recalculateGlobalStatus($deliverable)
    {
        if (!$deliverable) return;

        $activities = $deliverable->roleActivities()
            ->where('status', '!=', 'not_applicable')
            ->get();

        if ($activities->isEmpty()) return;

        // 1. Si la actividad de QA está aprobada, el entregable está terminado
        $qaActivity = $activities->firstWhere('role', 'qa');
        if ($qaActivity && $qaActivity->status === 'approved') {
            $deliverable->global_status = 'finished';
            $deliverable->save();
            return;
        }

        // 2. Si todos los roles aplicables están aprobados
        $total = $activities->count();
        $approvedCount = $activities->where('status', 'approved')->count();
        if ($approvedCount === $total) {
            $deliverable->global_status = 'finished';
            $deliverable->save();
            return;
        }

        // 3. Si hay al menos una actividad devuelta con observaciones o hallazgos
        $hasObservations = $activities->contains(function ($a) {
            return in_array($a->status, ['adjustments_requested', 'with_findings'], true);
        });

        // 4. Si hay al menos una actividad en revisión/entregada (pero no aprobada por QA)
        $hasInReview = $activities->contains(function ($a) {
            return in_array($a->status, ['delivered', 'in_review'], true);
        });

        // 5. Si hay actividades activas (cualquier estado diferente a aprobado o entregado/revisión)
        $hasActive = $activities->contains(function ($a) {
            return !in_array($a->status, ['approved', 'delivered', 'in_review'], true);
        });

        if ($hasObservations) {
            $deliverable->global_status = 'with_observations';
        } elseif ($hasActive) {
            $deliverable->global_status = 'in_progress';
        } elseif ($hasInReview) {
            $deliverable->global_status = 'in_review';
        } else {
            $deliverable->global_status = 'unpublished';
        }

        $deliverable->save();
    }

    public function getObservations(Request $request, RoleActivity $activity)
    {
        if ($denied = $this->authorizeActivity($request, $activity)) {
            return $denied;
        }

        $observations = $activity->observations()
            ->with('user')
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json(['data' => $observations]);
    }

    public function addObservation(Request $request, RoleActivity $activity)
    {
        if ($denied = $this->authorizeActivity($request, $activity)) {
            return $denied;
        }

        $data = $request->validate([
            'observation' => 'required|string|max:5000',
        ]);

        $obs = $activity->observations()->create([
            'user_id' => $request->user()->id,
            'observation' => $data['observation'],
        ]);

        return response()->json($obs->load('user'), 201);
    }
}
