<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Services\WorkingDayService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class WorkspaceController extends Controller
{
    private const OPERATIONAL_ROLES = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

    // Cadena de roles para determinar siguiente
    private const ROLE_CHAIN = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

    // Grupos de status por categoría para stats
    private const STATUS_PENDING    = ['not_started', 'pending'];
    private const STATUS_IN_PROGRESS = ['in_development', 'in_progress', 'designing', 'production', 'implementing', 'draft'];
    private const STATUS_IN_REVIEW  = ['delivered', 'in_review', 'in_testing', 'validating', 'editing', 'adjusting'];
    private const STATUS_RETURNED   = ['adjustments_requested', 'with_findings'];
    private const STATUS_APPROVED   = ['approved'];

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $user->role;

        if (in_array($role, ['admin', 'coordinator'])) {
            return $this->adminWorkspace($user, $role);
        }

        return $this->operationalWorkspace($user, $role);
    }

    private function adminWorkspace($user, $role)
    {
        $projects = Project::with('responsible', 'creator')
            ->where('status', 'in_progress')
            ->get();

        $totalDeliverables    = Deliverable::count();
        $finishedDeliverables = Deliverable::where('global_status', 'finished')->count();

        $allActivities = RoleActivity::whereHas('deliverable')->with('deliverable.subject.academicProgram.project')->get();

        // Overdue: mismo scope que ReportController::dashboard() para que las
        // cifras coincidan entre el dashboard ejecutivo y este workspace.
        $overdue     = RoleActivity::overdue()->whereHas('deliverable')->count();
        $approaching = 0;

        $today = Carbon::today();

        foreach ($allActivities as $a) {
            if (!$a->commitment_date || $a->actual_delivery_date) continue;
            if (in_array($a->status, ['approved', 'not_applicable'], true)) continue;
            $status = WorkingDayService::getStatus(Carbon::parse($a->commitment_date));
            if ($status === 'approaching') $approaching++;
        }

        $recentActivities = RoleActivity::whereHas('deliverable')->with('deliverable.subject.academicProgram.project', 'responsible')
            ->orderBy('updated_at', 'desc')
            ->limit(10)
            ->get();

        // Historial de cumplimiento global de los últimos 6 meses
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $months[] = Carbon::today()->subMonths($i)->format('Y-m');
        }

        $history = [];
        foreach ($months as $month) {
            $totalInMonth = 0;
            $completedInMonth = 0;

            foreach ($allActivities as $a) {
                if (!$a->commitment_date) continue;
                $activityMonth = Carbon::parse($a->commitment_date)->format('Y-m');

                if ($activityMonth === $month) {
                    $totalInMonth++;
                    if ($a->status === 'approved' || $a->actual_delivery_date) {
                        $completedInMonth++;
                    }
                }
            }

            $history[] = $totalInMonth > 0 ? (int) round(($completedInMonth / $totalInMonth) * 100) : 100;
        }

        return response()->json([
            'user'  => new UserResource($user),
            'role'  => $role,
            'stats' => [
                'active_projects'        => $projects->count(),
                'total_deliverables'     => $totalDeliverables,
                'finished_deliverables'  => $finishedDeliverables,
                'overdue_activities'     => $overdue,
                'approaching_activities' => $approaching,
                
                // Claves de compatibilidad para el perfil del usuario
                'completed'              => $finishedDeliverables,
                'overdue'                => $overdue,
                'approaching'            => $approaching,
                'pending'                => max(0, $totalDeliverables - $finishedDeliverables),
                'history'                => $history,
                'compliance_percentage'  => $totalDeliverables > 0
                    ? (int) round(($finishedDeliverables / $totalDeliverables) * 100)
                    : 0,
            ],
            'projects'          => $projects,
            'recent_activities' => $recentActivities,
        ]);
    }

    private function operationalWorkspace($user, $role)
    {
        $today = Carbon::today();

        // 3 días hábiles aproximados = 4-5 días calendario
        $approachingLimit = $today->copy()->addDays(5);

        $activities = RoleActivity::where('responsible_id', $user->id)
            ->whereHas('deliverable')          // exclude activities whose deliverable was (soft-)deleted
            ->with([
                'deliverable.subject.academicProgram.project',
                'deliverable.roleActivities.responsible',
            ])
            ->get();

        $stats = [
            'pending'     => 0,
            'in_progress' => 0,
            'in_review'   => 0,
            'returned'    => 0,
            'approved'    => 0,
            'overdue'     => 0,
            'approaching' => 0,
        ];

        $mapped = $activities->map(function ($activity) use (&$stats, $today, $approachingLimit) {
            $status = $activity->status;

            // Clasificar por categoría de status
            if (in_array($status, self::STATUS_APPROVED)) {
                $stats['approved']++;
            } elseif (in_array($status, self::STATUS_RETURNED)) {
                $stats['returned']++;
            } elseif (in_array($status, self::STATUS_IN_REVIEW)) {
                $stats['in_review']++;
            } elseif (in_array($status, self::STATUS_IN_PROGRESS)) {
                $stats['in_progress']++;
            } else {
                // pending, not_started, etc.
                $stats['pending']++;
            }

            // Overdue: commitment_date < hoy, status != approved, sin actual_delivery_date
            $isOverdue    = false;
            $isApproaching = false;

            if ($activity->commitment_date && !in_array($status, self::STATUS_APPROVED)) {
                $commitDate = Carbon::parse($activity->commitment_date);
                if (is_null($activity->actual_delivery_date) && $commitDate->lt($today)) {
                    $isOverdue = true;
                    $stats['overdue']++;
                } elseif (is_null($activity->actual_delivery_date) && $commitDate->between($today, $approachingLimit)) {
                    $isApproaching = true;
                    $stats['approaching']++;
                }
            }

            // Determinar dateStatus
            $dateStatus = 'on_time';
            if ($isOverdue) $dateStatus = 'overdue';
            elseif ($isApproaching) $dateStatus = 'approaching';

            // Información del siguiente rol en la cadena
            $nextInfo = $this->resolveNextRole($activity);

            $deliverable = $activity->deliverable;
            $subject     = $deliverable?->subject;
            $program     = $subject?->academicProgram;
            $project     = $program?->project;

            return [
                'id'                        => $activity->id,
                'role'                      => $activity->role,
                'status'                    => $activity->status,
                'notes'                     => $activity->notes,
                'commitment_date'           => $activity->commitment_date?->toDateString(),
                'actual_start_date'         => $activity->actual_start_date?->toDateString(),
                'actual_delivery_date'      => $activity->actual_delivery_date?->toDateString(),
                'production_not_applicable' => (bool) $activity->production_not_applicable,
                'date_status'               => $dateStatus,
                'next_role'            => $nextInfo['next_role'],
                'next_responsible'     => $nextInfo['next_responsible'],
                'next_commitment_date' => $nextInfo['next_commitment_date'],
                'deliverable'          => $deliverable ? [
                    'id'       => $deliverable->id,
                    'name'     => $deliverable->name,
                    'type'     => $deliverable->type,
                    'semestre' => $deliverable->semestre ?? null,
                    'ciclo'    => $deliverable->ciclo ?? null,
                ] : null,
                'subject'              => $subject ? ['id' => $subject->id, 'name' => $subject->name] : null,
                'program'              => $program ? ['id' => $program->id, 'name' => $program->name] : null,
                'project'              => $project ? ['id' => $project->id, 'name' => $project->name, 'status' => $project->status] : null,
            ];
        });

        $now      = Carbon::now();
        $in30Days = $now->copy()->addDays(30);

        $calendarActivities = $mapped->filter(function ($a) use ($now, $in30Days) {
            if (!$a['commitment_date']) return false;
            $d = Carbon::parse($a['commitment_date']);
            return $d->between($now, $in30Days);
        })->values();

        // Claves de compatibilidad para el perfil del usuario
        $stats['completed'] = $stats['approved'];
        $stats['pending']   = $stats['pending'] + $stats['in_progress'] + $stats['in_review'] + $stats['returned'];

        $totalActivities = $activities->count();
        $stats['compliance_percentage'] = $totalActivities > 0
            ? (int) round(($stats['approved'] / $totalActivities) * 100)
            : 0;

        // Historial de cumplimiento individual de los últimos 6 meses
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $months[] = Carbon::today()->subMonths($i)->format('Y-m');
        }

        $history = [];
        foreach ($months as $month) {
            $totalInMonth = 0;
            $completedInMonth = 0;

            foreach ($activities as $a) {
                if (!$a->commitment_date) continue;
                $activityMonth = Carbon::parse($a->commitment_date)->format('Y-m');

                if ($activityMonth === $month) {
                    $totalInMonth++;
                    if ($a->status === 'approved' || $a->actual_delivery_date) {
                        $completedInMonth++;
                    }
                }
            }

            $history[] = $totalInMonth > 0 ? (int) round(($completedInMonth / $totalInMonth) * 100) : 100;
        }
        $stats['history'] = $history;

        return response()->json([
            'user'                => new UserResource($user),
            'role'                => $role,
            'stats'               => $stats,
            'activities'          => $mapped->values(),
            'calendar_activities' => $calendarActivities,
            'decisions'           => \App\Models\DecisionRecord::where('responsible_id', $user->id)
                ->whereNotNull('due_date')
                ->with(['project:id,name', 'program:id,name', 'creator:id,name'])
                ->orderByDesc('decision_date')
                ->get(),
        ]);
    }

    /**
     * Resuelve el siguiente rol en la cadena y su responsable para una activity.
     */
    private function resolveNextRole(RoleActivity $activity): array
    {
        $chain       = self::ROLE_CHAIN;
        $currentIdx  = array_search($activity->role, $chain);

        // Si es aprobado o es el último rol (qa), no hay siguiente
        if ($activity->status === 'approved' || $currentIdx === false || $currentIdx >= count($chain) - 1) {
            return [
                'next_role'            => null,
                'next_responsible'     => null,
                'next_commitment_date' => null,
            ];
        }

        $nextRole = $chain[$currentIdx + 1];

        // Buscar la role_activity del siguiente rol en el mismo entregable
        $nextActivity = $activity->deliverable?->roleActivities
            ?->firstWhere('role', $nextRole);

        return [
            'next_role'            => $nextRole,
            'next_responsible'     => $nextActivity?->responsible?->name,
            'next_commitment_date' => $nextActivity?->commitment_date?->toDateString(),
        ];
    }
}
