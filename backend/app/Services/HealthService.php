<?php

namespace App\Services;

use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\SystemSetting;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Indicador de salud de proyecto (verde/amarillo/rojo).
 *
 * score = max(0, 100 − Σ peso_factor × factor) con factores normalizados 0–1.
 * Pesos y umbrales viven en system_settings (grupo `health`): la fórmula es
 * configurable por el administrador sin tocar código; un peso en 0 desactiva
 * el factor.
 */
final class HealthService
{
    private const FACTOR_LABELS = [
        'overdue'             => 'Actividades vencidas',
        'deliverable_delay'   => 'Entregables atrasados',
        'team_overload'       => 'Sobrecarga del equipo',
        'schedule_deviation'  => 'Desviación de cronograma',
    ];

    public static function forProject(Project $project): array
    {
        $activities = RoleActivity::with('deliverable')
            ->whereHas('deliverable.subject.academicProgram', function ($q) use ($project) {
                $q->where('project_id', $project->id);
            })
            ->get();

        return self::buildEntry($project, $activities);
    }

    /** Salud de todos los proyectos activos + agregado de portafolio. */
    public static function portfolio(): array
    {
        $projects = Project::active()->get();

        // Una sola query para todas las actividades, agrupadas por proyecto
        $activities = RoleActivity::with('deliverable.subject.academicProgram')
            ->whereHas('deliverable.subject.academicProgram', function ($q) use ($projects) {
                $q->whereIn('project_id', $projects->pluck('id'));
            })
            ->get()
            ->groupBy(fn ($a) => $a->deliverable?->subject?->academicProgram?->project_id);

        $entries = $projects
            ->map(fn ($p) => self::buildEntry($p, $activities->get($p->id, collect())))
            ->values();

        $portfolioScore = $entries->isEmpty() ? 100 : (int) round($entries->avg('score'));

        return [
            'portfolio_score' => $portfolioScore,
            'portfolio_level' => self::levelFor($portfolioScore),
            'projects'        => $entries->sortBy('score')->values()->all(),
        ];
    }

    private static function buildEntry(Project $project, Collection $activities): array
    {
        $today  = Carbon::today();
        $active = $activities->filter(
            fn ($a) => !in_array($a->status, ['approved', 'delivered', 'not_applicable'])
        );

        $isOverdue = fn ($a) => $a->commitment_date
            && $a->commitment_date->lt($today)
            && is_null($a->actual_delivery_date)
            && !in_array($a->status, RoleActivity::NOT_OVERDUE_STATUSES, true);

        // Factor 1: proporción de actividades activas vencidas
        $overdueCount  = $activities->filter($isOverdue)->count();
        $factorOverdue = $active->count() > 0 ? $overdueCount / $active->count() : 0.0;

        // Factor 2: entregables no terminados con ≥1 actividad vencida
        $byDeliverable      = $activities->groupBy('deliverable_id');
        $openDeliverables   = $byDeliverable->filter(
            fn ($acts) => $acts->contains(fn ($a) => !in_array($a->status, ['approved', 'delivered', 'not_applicable']))
        );
        $delayedDeliverables = $openDeliverables->filter(
            fn ($acts) => $acts->contains($isOverdue)
        );
        $factorDelay = $openDeliverables->count() > 0
            ? $delayedDeliverables->count() / $openDeliverables->count()
            : 0.0;

        // Factor 3: usuarios sobrecargados entre los que trabajan en el proyecto
        $responsibleIds = $active->pluck('responsible_id')->filter()->unique();
        $factorOverload = 0.0;
        if ($responsibleIds->isNotEmpty()) {
            $capacityByUser = collect(CapacityService::allUsers())->keyBy('user_id');
            $overloaded = $responsibleIds->filter(
                fn ($id) => ($capacityByUser->get($id)['status'] ?? 'ok') === 'overloaded'
            );
            $factorOverload = $overloaded->count() / $responsibleIds->count();
        }

        // Factor 4: desviación de cronograma (días hábiles promedio de retraso
        // en entregas hechas tarde, normalizado a 10 días)
        $lateDeliveries = $activities->filter(
            fn ($a) => $a->actual_delivery_date
                && $a->commitment_date
                && $a->actual_delivery_date->gt($a->commitment_date)
        );
        $factorDeviation = 0.0;
        if ($lateDeliveries->isNotEmpty()) {
            $avgDelay = $lateDeliveries->avg(
                fn ($a) => $a->commitment_date->diffInWeekdays($a->actual_delivery_date)
            );
            $factorDeviation = min(1.0, $avgDelay / 10);
        }

        $factors = [
            ['key' => 'overdue',            'raw' => $factorOverdue],
            ['key' => 'deliverable_delay',  'raw' => $factorDelay],
            ['key' => 'team_overload',      'raw' => $factorOverload],
            ['key' => 'schedule_deviation', 'raw' => $factorDeviation],
        ];

        $penaltyTotal = 0.0;
        $factors = array_map(function (array $f) use (&$penaltyTotal) {
            $weight  = SystemSetting::num("health.weight_{$f['key']}", 25);
            $penalty = round($weight * $f['raw'], 1);
            $penaltyTotal += $penalty;

            return [
                'key'     => $f['key'],
                'label'   => self::FACTOR_LABELS[$f['key']],
                'raw'     => round($f['raw'], 3),
                'weight'  => $weight,
                'penalty' => $penalty,
            ];
        }, $factors);

        $score = (int) max(0, round(100 - $penaltyTotal));

        return [
            'project_id'   => $project->id,
            'project_name' => $project->name,
            'score'        => $score,
            'level'        => self::levelFor($score),
            'factors'      => $factors,
        ];
    }

    private static function levelFor(int $score): string
    {
        if ($score >= SystemSetting::num('health.threshold_yellow', 80)) {
            return 'green';
        }
        if ($score >= SystemSetting::num('health.threshold_red', 60)) {
            return 'yellow';
        }
        return 'red';
    }
}
