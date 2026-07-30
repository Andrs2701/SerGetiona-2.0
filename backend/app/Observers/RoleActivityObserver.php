<?php

namespace App\Observers;

use App\Models\RoleActivity;
use App\Services\ProductionEventService;

class RoleActivityObserver
{
    /**
     * Auto-asigna 'not_applicable' cuando no hay responsable al crear, o
     * registra la fecha de asignación (assigned_at) cuando sí lo hay — ningún
     * controlador la seteaba, así que el evento "Asignada a X" del timeline
     * (DeliverableController::timeline(), que exige assigned_at) nunca
     * aparecía para ninguna actividad, sin importar cómo se hubiera creado.
     */
    public function creating(RoleActivity $activity): void
    {
        if (is_null($activity->responsible_id)) {
            $activity->status               = 'not_applicable';
            $activity->actual_delivery_date = null;
        } elseif (is_null($activity->assigned_at)) {
            $activity->assigned_at = now();
        }
    }

    /**
     * Registra evento de asignación inicial al crear.
     */
    public function created(RoleActivity $activity): void
    {
        if (!is_null($activity->responsible_id)) {
            ProductionEventService::record(
                entity: $activity,
                eventType: 'asignada',
                toState: $activity->status,
                payload: ['responsible_id' => $activity->responsible_id]
            );
        }
    }

    /**
     * Sincroniza el estado cuando cambia el responsable — DEBE correr en
     * "updating" (antes del UPDATE), no en "updated": mutar atributos después
     * de que la fila ya se guardó no los persiste, solo cambia el objeto en
     * memoria. Este mismo bug ya existía documentado como corregido antes de
     * la instrumentación de production_events; el commit e48dc36 lo revirtió
     * sin querer al mover toda la lógica a "updated" para poder registrar
     * eventos. Ver RoleActivityObserverTest / ProductionEventTest.
     */
    public function updating(RoleActivity $activity): void
    {
        if (!$activity->isDirty('responsible_id')) return;

        if (is_null($activity->responsible_id)) {
            $activity->status               = 'not_applicable';
            $activity->actual_delivery_date = null;
        } else {
            if ($activity->status === 'not_applicable') {
                $activity->status = 'not_started';
            }
            if (is_null($activity->assigned_at)) {
                $activity->assigned_at = now();
            }
        }
    }

    /**
     * Registra eventos de producción una vez que los cambios ya quedaron
     * persistidos (incluida la sincronización de estado hecha en "updating").
     */
    public function updated(RoleActivity $activity): void
    {
        // 1. Eventos de (re)asignación de responsable
        if ($activity->isDirty('responsible_id')) {
            $oldResp = $activity->getOriginal('responsible_id');
            $newResp = $activity->responsible_id;

            if ($newResp && $oldResp) {
                ProductionEventService::record(
                    entity: $activity,
                    eventType: 'reasignada',
                    payload: ['old_responsible_id' => $oldResp, 'new_responsible_id' => $newResp]
                );
            } elseif ($newResp && !$oldResp) {
                ProductionEventService::record(
                    entity: $activity,
                    eventType: 'asignada',
                    toState: $activity->status,
                    payload: ['responsible_id' => $newResp]
                );
            }
        }

        // 2. Registro de eventos según cambio de estado
        if ($activity->isDirty('status')) {
            $oldStatus = $activity->getOriginal('status');
            $newStatus = $activity->status;

            $eventType = match ($newStatus) {
                'in_progress', 'in_development' => 'iniciada',
                'delivered'                     => 'entregada',
                'approved'                      => 'aprobada',
                'adjustments_requested', 'with_findings' => 'devuelta',
                'not_applicable'                => 'no_aplica_marcado',
                default                         => 'estado_cambiado',
            };

            ProductionEventService::record(
                entity: $activity,
                eventType: $eventType,
                fromState: $oldStatus,
                toState: $newStatus,
                reasonCode: request('reason_code'),
                payload: request('adjust_roles') ? ['roles_a_ajustar' => request('adjust_roles')] : null
            );
        }
    }
}

