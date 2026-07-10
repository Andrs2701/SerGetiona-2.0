<?php

namespace App\Services;

use App\Models\CapacitySnapshot;
use App\Models\RoleActivity;
use App\Models\SystemSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Cálculo de capacidad operativa (información gerencial).
 *
 * Carga semanal de un usuario = Σ puntos de complejidad de sus actividades
 * exigibles esta semana: no aprobadas/no aplica, con fecha de compromiso
 * hasta el fin de la semana actual (las vencidas siguen contando hasta que
 * se entregan). Los puntos salen del nivel de complejidad del entregable;
 * sin nivel asignado se usa el setting `capacity.default_points`.
 */
final class CapacityService
{
    public const EXCLUDED_STATUSES = ['approved', 'delivered', 'not_applicable'];

    public static function pointsFor(RoleActivity $activity): float
    {
        $level = $activity->deliverable?->complexityLevel;

        if ($level && $level->is_active) {
            return (float) $level->points;
        }

        return SystemSetting::num('capacity.default_points', 3);
    }

    public static function capacityFor(User $user): float
    {
        return (float) ($user->weekly_capacity_points
            ?? SystemSetting::num('capacity.default_weekly_points', 10));
    }

    private static function statusFor(float $utilizationPct): string
    {
        if ($utilizationPct > SystemSetting::num('capacity.threshold_overload', 100)) {
            return 'overloaded';
        }
        if ($utilizationPct >= SystemSetting::num('capacity.threshold_high', 80)) {
            return 'high';
        }
        return 'ok';
    }

    /**
     * Actividades que consumen capacidad esta semana: asignadas, no
     * terminadas y exigibles hasta el fin de la semana actual.
     */
    private static function activeActivities(): Collection
    {
        return RoleActivity::whereHas('deliverable')->with('deliverable.complexityLevel')
            ->whereNotNull('responsible_id')
            ->whereNotIn('status', self::EXCLUDED_STATUSES)
            ->whereNotNull('commitment_date')
            ->where('commitment_date', '<=', Carbon::today()->endOfWeek()->toDateString())
            ->get();
    }

    private static function buildUserEntry(User $user, Collection $activities): array
    {
        $today = now()->toDateString();

        $activePoints = round($activities->sum(fn ($a) => self::pointsFor($a)), 1);
        $capacity     = self::capacityFor($user);
        $utilization  = $capacity > 0 ? round($activePoints / $capacity * 100, 1) : 0.0;

        $overdue = $activities->filter(function ($a) use ($today) {
            return $a->commitment_date
                && $a->commitment_date->toDateString() < $today
                && is_null($a->actual_delivery_date)
                && !in_array($a->status, \App\Models\RoleActivity::NOT_OVERDUE_STATUSES, true);
        })->count();

        return [
            'user_id'           => $user->id,
            'user_name'         => $user->name,
            'role'              => $user->role,
            'capacity_points'   => $capacity,
            'active_points'     => $activePoints,
            'active_activities' => $activities->count(),
            'overdue'           => $overdue,
            'utilization_pct'   => $utilization,
            'status'            => self::statusFor($utilization),
        ];
    }

    public static function forUser(User $user): array
    {
        $activities = self::activeActivities()->where('responsible_id', $user->id);

        return self::buildUserEntry($user, $activities);
    }

    /**
     * Capacidad de todos los usuarios operativos activos (incluye usuarios
     * sin actividades: su capacidad libre también es información gerencial).
     */
    public static function allUsers(): array
    {
        $byUser = self::activeActivities()->groupBy('responsible_id');

        $users = User::where('is_active', true)
            ->whereNotIn('role', ['admin', 'coordinator'])
            ->get();

        return $users
            ->map(fn ($u) => self::buildUserEntry($u, $byUser->get($u->id, collect())))
            ->sortByDesc('utilization_pct')
            ->values()
            ->all();
    }

    public static function byRole(): array
    {
        $entries = collect(self::allUsers());

        return $entries
            ->groupBy('role')
            ->map(function (Collection $group, string $role) {
                $capacity = $group->sum('capacity_points');
                $active   = round($group->sum('active_points'), 1);

                return [
                    'role'             => $role,
                    'users'            => $group->count(),
                    'capacity_points'  => $capacity,
                    'active_points'    => $active,
                    'utilization_pct'  => $capacity > 0 ? round($active / $capacity * 100, 1) : 0.0,
                    'overloaded_users' => $group->where('status', 'overloaded')->count(),
                ];
            })
            ->sortByDesc('utilization_pct')
            ->values()
            ->all();
    }

    public static function global(): array
    {
        $entries  = collect(self::allUsers());
        $capacity = $entries->sum('capacity_points');
        $active   = round($entries->sum('active_points'), 1);
        $utilization = $capacity > 0 ? round($active / $capacity * 100, 1) : 0.0;

        return [
            'capacity_points'  => $capacity,
            'active_points'    => $active,
            'available_points' => round(max(0, $capacity - $active), 1),
            'utilization_pct'  => $utilization,
            'overloaded_users' => $entries->where('status', 'overloaded')->count(),
            'status'           => $utilization > SystemSetting::num('capacity.threshold_overload', 100)
                ? 'overloaded'
                : ($utilization >= SystemSetting::num('capacity.threshold_high', 80) ? 'high' : 'ok'),
        ];
    }

    /**
     * Serie semanal desde capacity_snapshots (más antiguo → más reciente).
     */
    public static function trend(int $weeks = 8, ?int $userId = null, ?string $role = null): array
    {
        self::ensureWeeklySnapshot();

        $from = Carbon::today()->startOfWeek()->subWeeks($weeks - 1)->toDateString();

        $query = CapacitySnapshot::where('snapshot_date', '>=', $from);

        if ($userId) {
            $query->where('user_id', $userId);
        }
        if ($role) {
            $query->where('role', $role);
        }

        return $query->get()
            ->groupBy(fn ($s) => $s->snapshot_date->toDateString())
            ->map(function (Collection $group, string $date) {
                $capacity = $group->sum('capacity_points');
                $active   = round($group->sum('active_points'), 1);

                return [
                    'week_start'      => $date,
                    'active_points'   => $active,
                    'capacity_points' => $capacity,
                    'utilization_pct' => $capacity > 0 ? round($active / $capacity * 100, 1) : 0.0,
                    'overdue'         => $group->sum('overdue_count'),
                ];
            })
            ->sortKeys()
            ->values()
            ->all();
    }

    /**
     * Snapshot lazy de la semana actual (lunes). Idempotente: si ya existe
     * para esta semana no hace nada. No depende de cron.
     */
    public static function ensureWeeklySnapshot(): void
    {
        $weekStart = Carbon::today()->startOfWeek()->toDateString();

        // whereDate is safe against SQLite storing datetime vs date-only strings
        if (CapacitySnapshot::whereDate('snapshot_date', $weekStart)->exists()) {
            return;
        }

        foreach (self::allUsers() as $entry) {
            // Manual find-or-create using whereDate to avoid datetime vs date mismatch
            $exists = CapacitySnapshot::whereDate('snapshot_date', $weekStart)
                ->where('user_id', $entry['user_id'])
                ->exists();

            if (!$exists) {
                CapacitySnapshot::create([
                    'snapshot_date'     => $weekStart,
                    'user_id'           => $entry['user_id'],
                    'role'              => $entry['role'],
                    'active_points'     => $entry['active_points'],
                    'active_activities' => $entry['active_activities'],
                    'capacity_points'   => $entry['capacity_points'],
                    'utilization_pct'   => $entry['utilization_pct'],
                    'overdue_count'     => $entry['overdue'],
                    'created_at'        => now(),
                ]);
            }
        }
    }
}
