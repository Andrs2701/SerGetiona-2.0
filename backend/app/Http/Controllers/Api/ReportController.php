<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\User;
use App\Services\WorkingDayService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function workload(Request $request)
    {
        $user = $request->user();

        if (!in_array($user->role, ['admin', 'coordinator'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $pendingStatuses  = ['not_started', 'pending', 'in_development', 'in_progress', 'designing', 'production', 'implementing', 'draft'];
        $inReviewStatuses = ['delivered', 'in_review', 'in_testing', 'validating', 'editing', 'adjusting'];
        $today = now()->toDateString();

        $activities = RoleActivity::whereNotNull('responsible_id')->get();

        // Precargar todos los responsables de una sola consulta en vez de un
        // User::find() por cada uno dentro del map() (N+1).
        $usersById = User::whereIn('id', $activities->pluck('responsible_id')->unique())
            ->get()
            ->keyBy('id');

        $grouped = $activities->groupBy('responsible_id');

        $workload = $grouped->map(function ($items, $responsibleId) use ($pendingStatuses, $inReviewStatuses, $today, $usersById) {
            $user = $usersById->get($responsibleId);

            $pending  = $items->whereIn('status', $pendingStatuses)->count();
            $inReview = $items->whereIn('status', $inReviewStatuses)->count();
            $completed = $items->whereIn('status', RoleActivity::COMPLETED_STATUSES)->count();
            $overdue  = $items->filter(function ($a) use ($today) {
                return $a->commitment_date
                    && $a->commitment_date->toDateString() < $today
                    && is_null($a->actual_delivery_date)
                    && !in_array($a->status, RoleActivity::NOT_OVERDUE_STATUSES, true);
            })->count();

            return [
                'user_id'   => $responsibleId,
                'user_name' => $user?->name ?? 'Unknown',
                'role'      => $user?->role ?? '',
                'total'     => $items->count(),
                'pending'   => $pending,
                'in_review' => $inReview,
                'overdue'   => $overdue,
                'completed' => $completed,
            ];
        })->values()
          ->sortBy([
              ['overdue', 'desc'],
              ['total', 'desc'],
          ])
          ->values();

        return response()->json($workload);
    }

    /** GET /reports/executive-summary */
    public function executiveSummary()
    {
        return response()->json(\App\Services\ExecutiveSummaryService::build());
    }

    public function dashboard()
    {
        $projectsByStatus = Project::select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status');

        $deliverablesByStatus = Deliverable::select('global_status', DB::raw('count(*) as count'))
            ->groupBy('global_status')
            ->get()
            ->pluck('count', 'global_status');

        $totalDeliverables = Deliverable::count();
        $finishedDeliverables = Deliverable::where('global_status', 'finished')->count();
        $withObservations = Deliverable::where('global_status', 'with_observations')->count();
        $totalActivities = RoleActivity::whereHas('deliverable')
            ->where('status', '!=', 'not_applicable')
            ->count();
        $completedActivities = RoleActivity::whereHas('deliverable')
            ->completed()
            ->count();
        $globalCompliance = $totalActivities > 0
            ? round(($completedActivities / $totalActivities) * 100, 2)
            : 0;

        $activitiesByRole = RoleActivity::whereHas('deliverable')->select('role', DB::raw('count(*) as total'),
            DB::raw("sum(case when status = 'approved' then 1 else 0 end) as approved"))
            ->groupBy('role')
            ->get();

        // "Activo" = no cerrado todavía (vive, se ejecuta y se cierra — ver
        // tooltip del KPI), no estrictamente "in_progress": un proyecto en
        // draft/parameterized sigue siendo una iniciativa activa.
        $activeProjects = Project::whereNotIn('status', ['finished', 'cancelled'])->count();
        $totalPrograms = \App\Models\AcademicProgram::count();

        // Overdue: definición única en RoleActivity::scopeOverdue(), reutilizada
        // en todo el dashboard para que las tarjetas y desgloses coincidan.
        $overdueActivities = RoleActivity::overdue()->whereHas('deliverable')->count();

        // Approaching: actividades que vencen exactamente el mismo día de hoy
        // y aún no están entregadas o aprobadas.
        $todayStr = Carbon::today()->toDateString();
        $approachingActivities = RoleActivity::whereNotNull('commitment_date')
            ->where('commitment_date', $todayStr)
            ->whereNull('actual_delivery_date')
            ->whereNotIn('status', ['approved', 'delivered', 'not_applicable'])
            ->whereHas('deliverable')
            ->count();

        // Per-program breakdown — antes hacía ~5 consultas POR programa dentro
        // de un map() (N+1). Ahora se agrega una sola vez por cada métrica,
        // agrupada por programa, y el map() solo lee de esos totales ya
        // calculados sin disparar consultas nuevas.
        $programs = \App\Models\AcademicProgram::with('project')->get();

        $deliverablesByProgram = \App\Models\Deliverable::join('subjects', 'deliverables.subject_id', '=', 'subjects.id')
            ->select('subjects.academic_program_id', 'deliverables.global_status')
            ->get()
            ->groupBy('academic_program_id');

        $countByProgram = function ($query) {
            return $query
                ->join('deliverables', 'role_activities.deliverable_id', '=', 'deliverables.id')
                ->join('subjects', 'deliverables.subject_id', '=', 'subjects.id')
                ->select('subjects.academic_program_id', DB::raw('count(*) as total'))
                ->groupBy('subjects.academic_program_id')
                ->pluck('total', 'academic_program_id');
        };

        $totalActsByProgram = $countByProgram(
            RoleActivity::where('role_activities.status', '!=', 'not_applicable')
        );
        $completedActsByProgram = $countByProgram(RoleActivity::completed());
        $overdueByProgram = $countByProgram(RoleActivity::overdue());
        $activeByProgram = $countByProgram(RoleActivity::active());

        $programsBreakdown = $programs->map(function ($prog) use (
            $deliverablesByProgram, $totalActsByProgram, $completedActsByProgram, $overdueByProgram, $activeByProgram
        ) {
            $progDeliverables = $deliverablesByProgram->get($prog->id, collect());
            $total = $progDeliverables->count();
            $finished = $progDeliverables->where('global_status', 'finished')->count();

            $totalActs = $totalActsByProgram->get($prog->id, 0);
            $completedActs = $completedActsByProgram->get($prog->id, 0);
            $compliance = $totalActs > 0 ? round(($completedActs / $totalActs) * 100) : 0;

            return [
                'id'                                  => $prog->id,
                'name'                                => $prog->name,
                'project_id'                          => $prog->project_id,
                'project_name'                        => $prog->project->name ?? '',
                'total'                               => $total,
                'finished'                            => $finished,
                // % de entregables marcados como terminados (distinto de compliance_percentage,
                // que mide actividades completadas — pueden diferir legítimamente).
                'deliverable_completion_percentage'   => $total > 0 ? round(($finished / $total) * 100) : 0,
                'compliance_percentage'               => $compliance,
                'overdue_count'                       => $overdueByProgram->get($prog->id, 0),
                'active_count'                        => $activeByProgram->get($prog->id, 0),
                'pending_count'                       => max(0, $total - $finished),
            ];
        })->sortByDesc('overdue_count')->values();

        // Per-subject breakdown
        $subjects = \App\Models\Subject::with('academicProgram.project')->get();

        $deliverablesBySubject = \App\Models\Deliverable::select('subject_id', 'global_status')
            ->get()
            ->groupBy('subject_id');

        $countBySubject = function ($query) {
            return $query
                ->join('deliverables', 'role_activities.deliverable_id', '=', 'deliverables.id')
                ->select('deliverables.subject_id', DB::raw('count(*) as total'))
                ->groupBy('deliverables.subject_id')
                ->pluck('total', 'subject_id');
        };

        $totalActsBySubject = $countBySubject(
            RoleActivity::where('role_activities.status', '!=', 'not_applicable')
        );
        $completedActsBySubject = $countBySubject(RoleActivity::completed());
        $overdueBySubject = $countBySubject(RoleActivity::overdue());
        $activeBySubject = $countBySubject(RoleActivity::active());

        $subjectsBreakdown = $subjects->map(function ($sub) use (
            $deliverablesBySubject, $totalActsBySubject, $completedActsBySubject, $overdueBySubject, $activeBySubject
        ) {
            $subDeliverables = $deliverablesBySubject->get($sub->id, collect());
            $total = $subDeliverables->count();
            $finished = $subDeliverables->where('global_status', 'finished')->count();

            $totalActs = $totalActsBySubject->get($sub->id, 0);
            $completedActs = $completedActsBySubject->get($sub->id, 0);
            $compliance = $totalActs > 0 ? round(($completedActs / $totalActs) * 100) : 0;

            return [
                'id'                                  => $sub->id,
                'name'                                => $sub->name,
                'program_id'                          => $sub->academic_program_id,
                'program_name'                        => $sub->academicProgram->name ?? '',
                'project_id'                          => $sub->academicProgram->project_id ?? 0,
                'project_name'                        => $sub->academicProgram->project->name ?? '',
                'total'                               => $total,
                'finished'                            => $finished,
                'deliverable_completion_percentage'   => $total > 0 ? round(($finished / $total) * 100) : 0,
                'compliance_percentage'               => $compliance,
                'overdue_count'                       => $overdueBySubject->get($sub->id, 0),
                'active_count'                        => $activeBySubject->get($sub->id, 0),
                'pending_count'                       => max(0, $total - $finished),
            ];
        })->sortByDesc('overdue_count')->values();

        // Activities by role with more detail (for flow/bottleneck analysis)
        $inactiveList = implode("','", RoleActivity::INACTIVE_STATUSES);
        $activitiesByRoleDetail = RoleActivity::whereHas('deliverable')->select(
                'role',
                DB::raw('count(*) as total'),
                DB::raw("sum(case when status = 'approved' then 1 else 0 end) as approved"),
                DB::raw("sum(case when status NOT IN ('$inactiveList') then 1 else 0 end) as active")
            )
            ->groupBy('role')
            ->get();

        // overdue por rol usa el mismo scope que el resto del dashboard, no una
        // condición SQL propia, para que el desglose siempre sume igual que
        // la tarjeta "Vencidas" y que "Vencidos" por programa.
        $overdueByRole = RoleActivity::overdue()
            ->whereHas('deliverable')
            ->select('role', DB::raw('count(*) as overdue'))
            ->groupBy('role')
            ->pluck('overdue', 'role');

        $activitiesByRoleDetail = $activitiesByRoleDetail->map(function ($row) use ($overdueByRole) {
            $row->overdue = (int) ($overdueByRole[$row->role] ?? 0);
            return $row;
        });

        // Activities counts (for KPI cards)
        $totalActivities    = RoleActivity::whereHas('deliverable')->count();
        $finishedActivities = RoleActivity::whereHas('deliverable')->where('status', 'approved')->count();
        $activeActivities   = RoleActivity::whereHas('deliverable')->active()->count();

        return response()->json([
            'active_projects'             => $activeProjects,
            'total_programs'              => $totalPrograms,
            'total_deliverables'          => $totalDeliverables,
            'total_activities'            => $totalActivities,
            'finished_deliverables'       => $finishedDeliverables,
            'finished_activities'         => $finishedActivities,
            'active_activities'           => $activeActivities,
            'with_observations'           => $withObservations,
            'compliance_percentage'       => $globalCompliance,
            'overdue_activities'          => $overdueActivities,
            'approaching_activities'      => $approachingActivities,
            'projects_by_status'          => $projectsByStatus,
            'deliverables_by_status'      => $deliverablesByStatus,
            'global_compliance_percentage'=> $globalCompliance,
            'activities_by_role'          => $activitiesByRole,
            'activities_by_role_detail'   => $activitiesByRoleDetail,
            'programs_breakdown'          => $programsBreakdown,
            'subjects_breakdown'          => $subjectsBreakdown,
        ]);
    }

    public function compliance(Request $request)
    {
        $query = Deliverable::query();

        if ($request->filled('project_id')) {
            $query->whereHas('subject.academicProgram', function ($q) use ($request) {
                $q->where('project_id', $request->project_id);
            });
        }

        if ($request->filled('program_id')) {
            $query->whereHas('subject', function ($q) use ($request) {
                $q->where('academic_program_id', $request->program_id);
            });
        }

        $deliverables = $query->with('roleActivities')->get();

        $totalActs = \App\Models\RoleActivity::whereIn('deliverable_id', $deliverables->pluck('id'))
            ->where('status', '!=', 'not_applicable')
            ->count();
        $completedActs = \App\Models\RoleActivity::whereIn('deliverable_id', $deliverables->pluck('id'))
            ->completed()
            ->count();
        $compliance = $totalActs > 0 ? round(($completedActs / $totalActs) * 100, 2) : 0;

        // Compliance by role — antes disparaba 1 consulta POR rol (6 en total)
        // y calculaba "compliance_percentage" solo con status='approved',
        // divergiendo del resto del dashboard (que cuenta approved+delivered+
        // in_review como completado). Ahora es una sola consulta agrupada por
        // rol, usando la misma definición canónica de "completado".
        $roles = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];
        $completedList = implode("','", RoleActivity::COMPLETED_STATUSES);

        $roleStats = RoleActivity::where('status', '!=', 'not_applicable')
            ->when($request->filled('project_id'), function ($q) use ($request) {
                $q->whereHas('deliverable.subject.academicProgram', function ($q2) use ($request) {
                    $q2->where('project_id', $request->project_id);
                });
            })
            ->select(
                'role',
                DB::raw('count(*) as total'),
                DB::raw("sum(case when status = 'approved' then 1 else 0 end) as approved_count"),
                DB::raw("sum(case when status in ('$completedList') then 1 else 0 end) as completed_count"),
                DB::raw('sum(case when actual_delivery_date is not null and commitment_date is not null and actual_delivery_date <= commitment_date then 1 else 0 end) as on_time'),
                DB::raw('sum(case when actual_delivery_date is not null and commitment_date is not null and actual_delivery_date > commitment_date then 1 else 0 end) as late')
            )
            ->groupBy('role')
            ->get()
            ->keyBy('role');

        $byRole = [];
        foreach ($roles as $role) {
            $stats = $roleStats->get($role);
            $roleTotal = (int) ($stats->total ?? 0);
            $completedCount = (int) ($stats->completed_count ?? 0);

            $byRole[$role] = [
                'total' => $roleTotal,
                'approved' => (int) ($stats->approved_count ?? 0),
                'on_time' => (int) ($stats->on_time ?? 0),
                'late' => (int) ($stats->late ?? 0),
                'compliance_percentage' => $roleTotal > 0 ? round(($completedCount / $roleTotal) * 100, 2) : 0,
            ];
        }

        // Projects compliance — antes hacía 4 consultas extra POR proyecto
        // dentro de un map() (N+1); ahora se agrega una sola vez por proyecto.
        $deliverablesByProject = Deliverable::join('subjects', 'deliverables.subject_id', '=', 'subjects.id')
            ->join('academic_programs', 'subjects.academic_program_id', '=', 'academic_programs.id')
            ->select('academic_programs.project_id', 'deliverables.global_status')
            ->get()
            ->groupBy('project_id');

        $projectActCount = function ($query) {
            return $query
                ->join('deliverables', 'role_activities.deliverable_id', '=', 'deliverables.id')
                ->join('subjects', 'deliverables.subject_id', '=', 'subjects.id')
                ->join('academic_programs', 'subjects.academic_program_id', '=', 'academic_programs.id')
                ->select('academic_programs.project_id', DB::raw('count(*) as total'))
                ->groupBy('academic_programs.project_id')
                ->pluck('total', 'project_id');
        };

        $totalActsByProject = $projectActCount(RoleActivity::where('role_activities.status', '!=', 'not_applicable'));
        $completedActsByProject = $projectActCount(RoleActivity::completed());
        $delayedActsByProject = $projectActCount(
            RoleActivity::whereNotNull('actual_delivery_date')
                ->whereNotNull('commitment_date')
                ->whereColumn('actual_delivery_date', '>', 'commitment_date')
        );

        $projects = Project::withCount(['academicPrograms as programs_count'])
            ->get()
            ->map(function ($p) use ($deliverablesByProject, $totalActsByProject, $completedActsByProject, $delayedActsByProject) {
                $pDeliverables = $deliverablesByProject->get($p->id, collect());
                $pTotal = $pDeliverables->count();
                $pTotalActs = $totalActsByProject->get($p->id, 0);
                $pCompletedActs = $completedActsByProject->get($p->id, 0);
                $pApproved = $pDeliverables->where('global_status', 'finished')->count();
                $pDelayed = $delayedActsByProject->get($p->id, 0);

                return [
                    'id' => $p->id,
                    'name' => $p->name,
                    'compliance' => $pTotalActs > 0 ? round(($pCompletedActs / $pTotalActs) * 100) : 0,
                    'total' => $pTotal,
                    'approved' => $pApproved,
                    'delayed' => $pDelayed,
                ];
            });

        // By status counts
        $byStatus = Deliverable::select('global_status', DB::raw('count(*) as cnt'))
            ->groupBy('global_status')->get()->pluck('cnt', 'global_status');

        $statusKeys = ['unpublished','pending_start','in_progress','in_review','with_observations','finished','cancelled','not_applicable'];
        $byStatusFull = [];
        foreach ($statusKeys as $k) {
            $byStatusFull[$k] = (int)($byStatus[$k] ?? 0);
        }

        // By role as array
        $byRoleArray = collect($byRole)->map(fn($v, $k) => [
            'role' => $k,
            'on_time' => $v['on_time'],
            'delayed' => $v['late'],
        ])->values();

        $totalApproved = collect($byRole)->sum('approved');
        $totalDelayed = collect($byRole)->sum('late');

        return response()->json([
            'projects' => $projects,
            'by_status' => $byStatusFull,
            'by_role' => $byRoleArray,
            'global_compliance' => $compliance,
            'total_approved' => $totalApproved,
            'total_delayed' => $totalDelayed,
        ]);
    }

    // ─── GET /reports/overdue-list ────────────────────────────────────
    // Devuelve la lista detallada de actividades vencidas usando EXACTAMENTE
    // el mismo scope que la tarjeta del dashboard para garantizar consistencia.
    public function overdueList()
    {
        $activities = RoleActivity::overdue()
            ->whereHas('deliverable')
            ->with(['deliverable.subject.academicProgram.project', 'responsible'])
            ->get();

        return response()->json($this->formatActivityList($activities));
    }

    // ─── GET /reports/approaching-list ────────────────────────────────
    // Devuelve la lista detallada de actividades por vencer (que vencen hoy)
    // usando la misma lógica que la tarjeta del dashboard.
    public function approachingList()
    {
        $todayStr = Carbon::today()->toDateString();
        $activities = RoleActivity::whereNotNull('commitment_date')
            ->where('commitment_date', $todayStr)
            ->whereNull('actual_delivery_date')
            ->whereNotIn('status', ['approved', 'delivered', 'not_applicable'])
            ->whereHas('deliverable')
            ->with(['deliverable.subject.academicProgram.project', 'responsible'])
            ->get();

        return response()->json($this->formatActivityList($activities));
    }

    /**
     * Formatea una colección de RoleActivity en un array listo para el frontend.
     */
    private function formatActivityList($activities): array
    {
        $today = Carbon::today();

        return $activities->map(function ($a) use ($today) {
            $deliverable = $a->deliverable;
            $subject = $deliverable?->subject;
            $program = $subject?->academicProgram;
            $project = $program?->project;

            $commitDate = $a->commitment_date ? Carbon::parse($a->commitment_date) : null;
            $daysDiff = $commitDate ? $today->diffInDays($commitDate, false) : 0;

            return [
                'id'              => $a->id,
                'role'            => $a->role,
                'status'          => $a->status,
                'commitment_date' => $a->commitment_date?->toDateString(),
                'days_diff'       => (int) round($daysDiff),
                'responsible'     => $a->responsible?->name ?? '—',
                'deliverable_id'  => $deliverable?->id,
                'deliverable'     => $deliverable?->name ?? '—',
                'subject'         => $subject?->name ?? '—',
                'program'         => $program?->name ?? '—',
                'project'         => $project?->name ?? '—',
            ];
        })->values()->toArray();
    }
}
