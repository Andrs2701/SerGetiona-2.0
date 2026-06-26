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
     * Auto-asigna 'not_applicable' cuando se retira el responsable.
     * Si se asigna un responsable y el estado era 'not_applicable',
     * no lo cambia automáticamente — el coordinador lo gestiona.
     */
    public function updating(RoleActivity $activity): void
    {
        if ($activity->isDirty('responsible_id') && is_null($activity->responsible_id)) {
            $activity->status               = 'not_applicable';
            $activity->actual_delivery_date = null;
        }
    }
}
