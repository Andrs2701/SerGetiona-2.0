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

class RoleActivityController extends Controller
{
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
        $data = $request->validate([
            'responsible_id'       => 'nullable|exists:users,id',
            'assigned_at'          => 'nullable|date',
            'commitment_date'      => 'nullable|date',
            'actual_start_date'    => 'nullable|date',
            'actual_delivery_date' => 'nullable|date',
            'status'               => 'nullable|string|max:100',
            'notes'                => 'nullable|string',
        ]);

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

        // Notification: task assigned
        if (isset($dirty['responsible_id']) && $activity->responsible_id) {
            $newResponsible = User::find($activity->responsible_id);
            if ($newResponsible) {
                NotificationService::notify(
                    $newResponsible,
                    'task_assigned',
                    'Nueva actividad asignada',
                    "Se te ha asignado la actividad de rol '{$activity->role}'.",
                    ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id]
                );
            }
        }

        // Notification: status changed
        if (isset($dirty['status'])) {
            $coordinators = User::whereIn('role', ['admin', 'coordinator'])->get();
            NotificationService::notifyMany(
                $coordinators,
                'status_changed',
                'Estado de actividad cambiado',
                "La actividad '{$activity->role}' cambió de estado a '{$activity->status}'.",
                ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id, 'new_status' => $activity->status]
            );
        }

        // Notification: commitment date changed
        if (isset($dirty['commitment_date']) && $activity->responsible_id) {
            $responsible = User::find($activity->responsible_id);
            if ($responsible) {
                NotificationService::notify(
                    $responsible,
                    'date_changed',
                    'Fecha de compromiso actualizada',
                    "La fecha de compromiso de tu actividad '{$activity->role}' fue actualizada a {$activity->commitment_date}.",
                    ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id]
                );
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
        $data = $request->validate([
            'action' => 'required|in:deliver,approve,request_adjustments,reject',
        ]);

        $action  = $data['action'];
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

        // Notificar coordinadores del cambio de estado
        $coordinators = User::whereIn('role', ['admin', 'coordinator'])->get();
        NotificationService::notifyMany(
            $coordinators,
            'status_changed',
            'Estado de actividad cambiado',
            "La actividad '{$activity->role}' cambió de estado a '{$activity->status}' mediante acción rápida.",
            ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id, 'new_status' => $activity->status]
        );

        // Resolver siguiente rol en la cadena
        $roleChain   = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];
        $currentIdx  = array_search($activity->role, $roleChain);
        $nextRole    = null;
        $nextResponsible     = null;
        $nextCommitmentDate  = null;

        if ($currentIdx !== false && $currentIdx < count($roleChain) - 1 && $activity->status === 'approved') {
            $nextRole     = $roleChain[$currentIdx + 1];
            $nextActivity = $activity->deliverable?->roleActivities()
                ->where('role', $nextRole)
                ->with('responsible')
                ->first();
            $nextResponsible    = $nextActivity?->responsible?->name;
            $nextCommitmentDate = $nextActivity?->commitment_date?->toDateString();
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
    public function timeline(RoleActivity $activity)
    {
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
