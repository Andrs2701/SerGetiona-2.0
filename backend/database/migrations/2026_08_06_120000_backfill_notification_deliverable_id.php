<?php

use App\Models\Notification;
use App\Models\RoleActivity;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Antes de 02ddbd9 (fix del clic en notificaciones), task_assigned/
     * date_changed/activity_modified/adjustments_requested/next_in_chain se
     * guardaban sin deliverable_id en su `data` — sin ese dato,
     * getNotifRoute() no puede armar /entregables?deliverable=X, y el clic
     * en una notificación ya existente sigue sin abrir nada aunque el
     * código que la generó ya esté corregido. Este backfill completa las
     * filas que ya están en la base de datos.
     */
    public function up(): void
    {
        Notification::whereNotNull('data')->chunkById(500, function ($notifications) {
            foreach ($notifications as $notification) {
                $data = $notification->data ?? [];

                if (!empty($data['deliverable_id'])) {
                    continue;
                }

                $activityId = $data['activity_id']
                    ?? $data['role_activity_id']
                    ?? (($data['entity_type'] ?? null) === 'RoleActivity' ? ($data['entity_id'] ?? null) : null);

                if (!$activityId) {
                    continue;
                }

                $deliverableId = RoleActivity::where('id', $activityId)->value('deliverable_id');
                if (!$deliverableId) {
                    continue;
                }

                $data['deliverable_id'] = $deliverableId;
                $notification->data = $data;
                $notification->save();
            }
        });
    }

    /**
     * No-op deliberado: quitar deliverable_id no revierte a un estado
     * funcional (la notificación seguiría sin abrir nada), solo
     * reintroduciría el bug que este backfill corrige.
     */
    public function down(): void
    {
    }
};
