<?php

namespace App\Observers;

use App\Models\RoleActivity;

class RoleActivityObserver
{
    /**
     * Auto-asigna 'not_applicable' cuando no hay responsable al crear.
     */
    public function creating(RoleActivity $activity): void
    {
        if (is_null($activity->responsible_id)) {
            $activity->status               = 'not_applicable';
            $activity->actual_delivery_date = null;
        }
    }

    /**
     * Sincroniza el estado cuando cambia el responsable:
     * - Sin responsable → not_applicable
     * - Con responsable (antes not_applicable) → not_started
     */
    public function updating(RoleActivity $activity): void
    {
        if (!$activity->isDirty('responsible_id')) return;

        if (is_null($activity->responsible_id)) {
            $activity->status               = 'not_applicable';
            $activity->actual_delivery_date = null;
        } elseif ($activity->status === 'not_applicable') {
            $activity->status = 'not_started';
        }
    }
}
