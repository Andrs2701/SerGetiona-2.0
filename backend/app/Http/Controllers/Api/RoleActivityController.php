<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
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
            'notes'                => 'nullable|string',
        ]);

        if (!$isManager) {
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
                in_array($data['status'] ?? null, ['approved', 'not_applicable'], true),
                403,
                'No puedes aprobar tu propia actividad.'
            );
        }

        $original = $activity->getOriginal();
        $activity->update($data);
        $dirty = $activity->getChanges();

        foreach ($dirty as $field => $newValue) {
            if ($field === 'updated_at') continue;
            AuditLog::create([
                'user_id'      => Auth::id(),
                'action'       => 'updated',
                'entity_type'  => 'RoleActivity',
                'entity_id'    => $activity->id,
                'field_changed'=> $field,
                'old_value'    => $original[$field] ?? null,
                'new_value'    => $newValue,
                'ip_address'   => $request->ip(),
                'created_at'   => now(),
            ]);
        }

        $deliverableName = $activity->deliverable?->name ?? "entregable #{$activity->deliverable_id}";

        // Notification: task assigned (new responsible)
        if (isset($dirty['responsible_id']) && $activity->responsible_id) {
            $newResponsible = User::find($activity->responsible_id);
            if ($newResponsible) {
                NotificationService::notify(
                    $newResponsible,
                    'task_assigned',
                    'Nueva actividad asignada',
                    "Se te ha asignado la actividad de rol '{$activity->role}' en '{$deliverableName}'.",
                    ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id]
                );
            }
        }

        // Notification: status changed — notify coordinators/admin AND responsible AND next in chain
        if (isset($dirty['status'])) {
            $newLabel = self::translateStatus($activity->status);
            $managers = User::whereIn('role', ['admin', 'coordinator'])->get();
            NotificationService::notifyMany(
                $managers,
                'status_changed',
                'Estado de actividad cambiado',
                "La actividad '{$activity->role}' de '{$deliverableName}' cambió a '{$newLabel}'.",
                ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id, 'new_status' => $activity->status]
            );

            // Notify the responsible if change was made by a manager
            if ($isManager && $activity->responsible_id) {
                $responsible = User::find($activity->responsible_id);
                if ($responsible && !$managers->contains('id', $responsible->id)) {
                    NotificationService::notify(
                        $responsible,
                        'status_changed',
                        'Estado de tu actividad actualizado',
                        "El estado de tu actividad '{$activity->role}' en '{$deliverableName}' fue cambiado a '{$newLabel}'.",
                        ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id, 'new_status' => $activity->status]
                    );
                }
            }

            // Notify next responsible in the chain when current role marks as delivered or approved
            if (in_array($activity->status, ['delivered', 'approved'])) {
                $currentIdx = array_search($activity->role, self::ROLE_CHAIN);
                if ($currentIdx !== false && $currentIdx < count(self::ROLE_CHAIN) - 1) {
                    $nextRole     = self::ROLE_CHAIN[$currentIdx + 1];
                    $nextActivity = $activity->deliverable?->roleActivities()
                        ->where('role', $nextRole)
                        ->with('responsible')
                        ->first();
                    $nextUser = $nextActivity?->responsible;
                    if ($nextUser) {
                        $currentLabel = ucfirst($activity->role);
                        $verb = $activity->status === 'delivered' ? 'entregó' : 'aprobó';
                        NotificationService::notify(
                            $nextUser,
                            'next_in_chain',
                            'Tu turno en el flujo',
                            "El rol '{$currentLabel}' {$verb} su actividad en '{$deliverableName}'. Tu rol '{$nextRole}' es el siguiente.",
                            ['entity_type' => 'RoleActivity', 'entity_id' => $nextActivity->id]
                        );
                    }
                }
            }
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
        $isOwner = $activity->responsible_id === $user->id;

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
        $managers = User::whereIn('role', ['admin', 'coordinator'])->get();
        $newLabel = self::translateStatus($activity->status);
        $delName  = $activity->deliverable?->name ?? "entregable #{$activity->deliverable_id}";
        NotificationService::notifyMany(
            $managers,
            'status_changed',
            'Estado de actividad cambiado',
            "La actividad '{$activity->role}' de '{$delName}' cambió a '{$newLabel}'.",
            ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id, 'new_status' => $activity->status]
        );

        // Notify the activity owner (if different from who triggered the action)
        if ($activity->responsible_id && (int)$activity->responsible_id !== (int)Auth::id()) {
            $owner = User::find($activity->responsible_id);
            if ($owner && !$managers->contains('id', $owner->id)) {
                NotificationService::notify(
                    $owner,
                    'status_changed',
                    'Estado de tu actividad actualizado',
                    "El estado de tu actividad '{$activity->role}' en '{$delName}' fue cambiado a '{$newLabel}'.",
                    ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id]
                );
            }
        }

        // Resolver siguiente rol en la cadena
        $roleChain   = self::ROLE_CHAIN;
        $currentIdx  = array_search($activity->role, $roleChain);
        $nextRole    = null;
        $nextResponsible     = null;
        $nextCommitmentDate  = null;
        $nextActivity        = null;

        if ($currentIdx !== false && $currentIdx < count($roleChain) - 1 && $activity->status === 'approved') {
            $nextRole     = $roleChain[$currentIdx + 1];
            $nextActivity = $activity->deliverable?->roleActivities()
                ->where('role', $nextRole)
                ->with('responsible')
                ->first();
            $nextResponsible    = $nextActivity?->responsible?->name;
            $nextCommitmentDate = $nextActivity?->commitment_date?->toDateString();

            // Notify the next responsible
            $nextUser = $nextActivity?->responsible;
            if ($nextUser) {
                $currentLabel = ucfirst($activity->role);
                NotificationService::notify(
                    $nextUser,
                    'next_in_chain',
                    'Tu turno en el flujo',
                    "El rol '{$currentLabel}' aprobó su actividad en '{$delName}'. Tu rol '{$nextRole}' es el siguiente en el proceso.",
                    ['entity_type' => 'RoleActivity', 'entity_id' => $nextActivity->id]
                );
            }
        }

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
