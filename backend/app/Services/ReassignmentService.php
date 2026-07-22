<?php

namespace App\Services;

use App\Models\RoleActivity;
use App\Models\User;

/**
 * Motor de sugerencia de reasignación. NUNCA reasigna: solo recomienda
 * candidatos del mismo rol ordenados por disponibilidad. La reasignación
 * real la ejecuta un gerente vía PUT /activities/{id} (que ya notifica).
 */
final class ReassignmentService
{
    public static function suggestionsFor(RoleActivity $activity, int $limit = 5): array
    {
        $points = CapacityService::pointsFor($activity);

        $candidates = User::where('is_active', true)
            ->where(function ($q) use ($activity) {
                // Incluye tambien a quien cubre temporalmente este rol
                // (vacaciones/incapacidades) ademas de a quien lo tiene
                // como rol propio — ver RoleCoverage.
                $q->where('role', $activity->role)
                    ->orWhereHas('roleCoverages', fn ($q2) => $q2->where('covering_role', $activity->role)->active());
            })
            ->where('id', '!=', $activity->responsible_id ?? 0)
            ->get();

        return $candidates
            ->map(function (User $user) use ($points) {
                $entry = CapacityService::forUser($user);
                $capacity = $entry['capacity_points'];

                $entry['utilization_after'] = $capacity > 0
                    ? round(($entry['active_points'] + $points) / $capacity * 100, 1)
                    : 0.0;

                return [
                    'user_id'           => $entry['user_id'],
                    'name'              => $entry['user_name'],
                    'utilization_pct'   => $entry['utilization_pct'],
                    'active_points'     => $entry['active_points'],
                    'capacity_points'   => $entry['capacity_points'],
                    'overdue'           => $entry['overdue'],
                    'utilization_after' => $entry['utilization_after'],
                ];
            })
            ->sortBy([
                ['utilization_pct', 'asc'],
                ['overdue', 'asc'],
            ])
            ->take($limit)
            ->values()
            ->all();
    }
}
