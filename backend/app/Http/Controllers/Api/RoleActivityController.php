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
            'status'               => ['nullable', Rule::in([
                'not_started', 'draft', 'in_development', 'in_progress', 'delivered',
                'adjustments_requested', 'approved', 'not_applicable', 'in_review',
                'adjusting', 'designing', 'production', 'editing', 'implementing',
                'validating', 'pending', 'in_testing', 'with_findings',
            ])],
            'notes'                      => 'nullable|string',
            'production_not_applicable'  => 'sometimes|boolean',
        ]);

        if (!$isManager) {
            abort_if(
                in_array($activity->status, ['delivered', 'approved'], true),
                403,
                'Esta actividad ya ha sido entregada o aprobada y no puede ser modificada.'
            );

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
                ($data['status'] ?? null) === 'approved',
                403,
                'No puedes aprobar tu propia actividad.'
            );
        }

        if (isset($data['status'])) {
            if (in_array($data['status'], ['delivered', 'approved'], true)) {
                if (empty($data['actual_delivery_date'])) {
                    $data['actual_delivery_date'] = Carbon::today()->toDateString();
                }
            } else {
                $data['actual_delivery_date'] = null;
            }
        }

        $activity->update($data);
        $dirty = $activity->getChanges();

        $activity->loadMissing('deliverable.subject.academicProgram');
        $deliverableName = $activity->deliverable?->name ?? "entregable #{$activity->deliverable_id}";

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

        return response()->json($activity->load('responsible', 'assignedBy'));
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
                break;

            case 'reject':
                $activity->status = 'with_findings';
                break;
        }

        $activity->save();

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

        $activity->load('responsible', 'assignedBy', 'deliverable');

        return response()->json([
            'activity'             => $activity,
            'next_role'            => $nextRole,
            'next_responsible'     => $nextResponsible,
            'next_commitment_date' => $nextCommitmentDate,
        ]);
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
            } elseif ($log->field_changed === 'notes' && $log->new_value) {
                $events[] = [
                    'type'  => 'note',
                    'icon'  => 'message',
                    'label' => 'Observación actualizada',
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
}
