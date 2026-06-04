<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\RoleActivity;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RoleActivityController extends Controller
{
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
}
