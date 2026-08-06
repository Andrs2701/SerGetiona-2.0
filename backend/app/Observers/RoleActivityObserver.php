<?php

namespace App\Observers;

use App\Http\Controllers\Api\RoleActivityController;
use App\Models\RoleActivity;
use App\Services\ProductionEventService;
use Illuminate\Support\Facades\Auth;

class RoleActivityObserver
{
    /**
     * Auto-asigna 'not_applicable' cuando no hay responsable al crear, o
     * registra la fecha de asignación (assigned_at) cuando sí lo hay — ningún
     * controlador la seteaba, así que el evento "Asignada a X" del timeline
     * (DeliverableController::timeline(), que exige assigned_at) nunca
     * aparecía para ninguna actividad, sin importar cómo se hubiera creado.
     *
     * created_by/assigned_by: mismo problema — ningún controlador (creación
     * manual, carga masiva, reasignación) los seteaba, así que "Actividad
     * creada" en el timeline y la notificación de asignación nunca decían
     * quién fue. Se centralizan aquí en vez de repetir Auth::id() en cada
     * sitio que crea o reasigna una actividad.
     */
    public function creating(RoleActivity $activity): void
    {
        if (is_null($activity->created_by)) {
            $activity->created_by = Auth::id();
        }

        if (is_null($activity->responsible_id)) {
            $activity->status               = 'not_applicable';
            $activity->actual_delivery_date = null;
        } elseif (is_null($activity->assigned_at)) {
            $activity->assigned_at = now();
            $activity->assigned_by = $activity->assigned_by ?? Auth::id();
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
        // first_delivered_at: se fija UNA sola vez, la primera vez que
        // actual_delivery_date pasa de vacío a tener un valor, y nunca se
        // vuelve a tocar — a diferencia de actual_delivery_date, que sí se
        // sobreescribe (y hasta ahora se borraba) en cada ciclo de revisión.
        // Sin esto, devolver una actividad con hallazgos hacía desaparecer
        // de la interfaz la fecha en que el responsable entregó por primera vez.
        if ($activity->isDirty('actual_delivery_date') && $activity->actual_delivery_date && is_null($activity->first_delivered_at)) {
            $activity->first_delivered_at = $activity->actual_delivery_date;
        }

        if (!$activity->isDirty('responsible_id')) return;

        if (is_null($activity->responsible_id)) {
            $activity->status               = 'not_applicable';
            $activity->actual_delivery_date = null;
        } else {
            if ($activity->status === 'not_applicable') {
                $activity->status = 'not_started';
            }
            // Se actualiza en CADA reasignación, no solo la primera vez: el
            // timeline muestra "Asignada a {responsable actual}" junto a esta
            // fecha, así que debe reflejar cuándo quedó asignado el responsable
            // de hoy, no el de la primera persona que tuvo el rol. Mismo
            // criterio para assigned_by: quién hizo ESTA reasignación, no
            // quién hizo la primera.
            $activity->assigned_at = now();
            $activity->assigned_by = Auth::id();
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

        if ($activity->isDirty('status') && $activity->deliverable) {
            RoleActivityController::recalculateGlobalStatus($activity->deliverable);
        }
    }
}

