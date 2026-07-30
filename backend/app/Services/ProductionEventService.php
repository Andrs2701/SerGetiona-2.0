<?php

namespace App\Services;

use App\Models\ProductionEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ProductionEventService
{
    /**
     * Registra un evento append-only en la bitácora de producción.
     * Diseñado para ser 100% fail-safe y no interrumpir transacciones activas.
     */
    public static function record(
        Model $entity,
        string $eventType,
        ?string $fromState = null,
        ?string $toState = null,
        ?string $reasonCode = null,
        ?array $payload = null,
        ?int $userId = null
    ): ?ProductionEvent {
        try {
            $deliverableId = match (true) {
                method_exists($entity, 'getDeliverableId') => $entity->getDeliverableId(),
                isset($entity->deliverable_id)            => $entity->deliverable_id,
                $entity instanceof \App\Models\Deliverable => $entity->id,
                default                                    => null,
            };

            $roleActivityId = match (true) {
                $entity instanceof \App\Models\RoleActivity => $entity->id,
                isset($entity->role_activity_id)            => $entity->role_activity_id,
                default                                     => null,
            };

            $subjectId = match (true) {
                isset($entity->subject_id)                => $entity->subject_id,
                isset($entity->deliverable?->subject_id)  => $entity->deliverable->subject_id,
                default                                   => null,
            };

            $role = match (true) {
                isset($entity->role)        => $entity->role,
                default                     => Auth::user()?->role ?? 'admin',
            };

            $ciclo = match (true) {
                isset($entity->ciclo)                     => $entity->ciclo,
                isset($entity->deliverable?->ciclo)       => $entity->deliverable->ciclo,
                default                                   => (string) date('Y') . (date('n') <= 6 ? '1' : '2'),
            };

            $effectiveUserId = $userId 
                ?? Auth::id() 
                ?? ($entity->responsible_id ?? null)
                ?? ($entity->user_id ?? null)
                ?? 1;

            return ProductionEvent::create([
                'deliverable_id'   => $deliverableId,
                'role_activity_id' => $roleActivityId,
                'subject_id'       => $subjectId,
                'entity_type'      => class_basename($entity),
                'entity_id'        => $entity->id,
                'role'             => $role,
                'user_id'          => $effectiveUserId,
                'event_type'       => $eventType,
                'from_state'       => $fromState,
                'to_state'         => $toState,
                'reason_code'      => $reasonCode,
                'payload'          => $payload,
                'ciclo'            => $ciclo,
                'occurred_at'      => Carbon::now()->format('Y-m-d H:i:s.u'),
            ]);
        } catch (\Throwable $e) {
            Log::error("ProductionEventService failed: {$e->getMessage()}", [
                'entity'     => get_class($entity),
                'entity_id'  => $entity->id ?? null,
                'event_type' => $eventType,
            ]);
            return null;
        }
    }
}
