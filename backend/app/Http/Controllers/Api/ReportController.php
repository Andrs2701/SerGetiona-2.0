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

        $grouped = $activities->groupBy('responsible_id');

        $workload = $grouped->map(function ($items, $responsibleId) use ($pendingStatuses, $inReviewStatuses, $today) {
            $user = User::find($responsibleId);

            $pending  = $items->whereIn('status', $pendingStatuses)->count();
            $inReview = $items->whereIn('status', $inReviewStatuses)->count();
            $completed = $items->where('status', 'approved')->count();
            $overdue  = $items->filter(function ($a) use ($today) {
                return $a->commitment_date
                    && $a->commitment_date->toDateString() < $today
                    && is_null($a->actual_delivery_date)
                    && !in_array($a->status, ['approved', 'not_applicable']);
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
            ->whereIn('status', ['approved', 'delivered', 'in_review'])
            ->count();
        $globalCompliance = $totalActivities > 0
            ? round(($completedActivities / $totalActivities) * 100, 2)
            : 0;

        $activitiesByRole = RoleActivity::whereHas('deliverable')->select('role', DB::raw('count(*) as total'),
            DB::raw("sum(case when status = 'approved' then 1 else 0 end) as approved"))
            ->groupBy('role')
            ->get();

        $activeProjects = Project::where('status', 'in_progress')->count();
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

        // Per-program breakdown
        $programs = \App\Models\AcademicProgram::with('project')->get();
        $programsBreakdown = $programs->map(function ($prog) {
            $deliverableIds = \App\Models\Subject::where('academic_program_id', $prog->id)
                ->pluck('id')
                ->pipe(fn($subjectIds) => \App\Models\Deliverable::whereIn('subject_id', $subjectIds)->pluck('id'));

            $total = $deliverableIds->count();
            $finished = \App\Models\Deliverable::whereIn('id', $deliverableIds)
                ->where('global_status', 'finished')->count();
            $totalActs = \App\Models\RoleActivity::whereIn('deliverable_id', $deliverableIds)
                ->where('status', '!=', 'not_applicable')
                ->count();
            $completedActs = \App\Models\RoleActivity::whereIn('deliverable_id', $deliverableIds)
                ->whereIn('status', ['approved', 'delivered', 'in_review'])
                ->count();
            $compliance = $totalActs > 0 ? round(($completedActs / $totalActs) * 100) : 0;

            $overdueCount = \App\Models\RoleActivity::whereIn('deliverable_id', $deliverableIds)
                ->overdue()
                ->count();

            $activeCount = \App\Models\RoleActivity::whereIn('deliverable_id', $deliverableIds)
                ->whereNotIn('status', ['approved', 'not_applicable', 'not_started'])
                ->count();

            return [
                'id'                    => $prog->id,
                'name'                  => $prog->name,
                'project_id'            => $prog->project_id,
                'project_name'          => $prog->project->name ?? '',
                'total'                 => $total,
                'finished'              => $finished,
                'compliance_percentage' => $compliance,
                'overdue_count'         => $overdueCount,
                'active_count'          => $activeCount,
                'pending_count'         => max(0, $total - $finished),
            ];
        })->sortByDesc('overdue_count')->values();

        // Activities by role with more detail (for flow/bottleneck analysis)
        $activitiesByRoleDetail = RoleActivity::whereHas('deliverable')->select(
                'role',
                DB::raw('count(*) as total'),
                DB::raw("sum(case when status = 'approved' then 1 else 0 end) as approved"),
                DB::raw("sum(case when status NOT IN ('approved','not_applicable','not_started') then 1 else 0 end) as active")
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
        $activeActivities   = RoleActivity::whereHas('deliverable')->whereNotIn('status', ['approved', 'not_applicable', 'not_started'])->count();

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
            ->whereIn('status', ['approved', 'delivered', 'in_review'])
            ->count();
        $compliance = $totalActs > 0 ? round(($completedActs / $totalActs) * 100, 2) : 0;

        // Compliance by role
        $roles = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];
        $byRole = [];
        foreach ($roles as $role) {
            $activities = RoleActivity::where('role', $role)
                ->when($request->filled('project_id'), function ($q) use ($request) {
                    $q->whereHas('deliverable.subject.academicProgram', function ($q2) use ($request) {
                        $q2->where('project_id', $request->project_id);
                    });
                })
                ->get();

            $roleTotal = $activities->count();
            $roleApproved = $activities->where('status', 'approved')->count();

            // On time vs late
            $onTime = $activities->filter(function ($a) {
                return $a->actual_delivery_date && $a->commitment_date
                    && $a->actual_delivery_date <= $a->commitment_date;
            })->count();

            $late = $activities->filter(function ($a) {
                return $a->actual_delivery_date && $a->commitment_date
                    && $a->actual_delivery_date > $a->commitment_date;
            })->count();

            $byRole[$role] = [
                'total' => $roleTotal,
                'approved' => $roleApproved,
                'on_time' => $onTime,
                'late' => $late,
                'compliance_percentage' => $roleTotal > 0 ? round(($roleApproved / $roleTotal) * 100, 2) : 0,
            ];
        }

        // Projects compliance
        $projects = Project::withCount(['academicPrograms as programs_count'])
            ->get()
            ->map(function ($p) {
                $deliverables = Deliverable::whereHas('subject.academicProgram', fn($q) => $q->where('project_id', $p->id))->get();
                $pTotal = $deliverables->count();

                $pTotalActs = RoleActivity::whereIn('deliverable_id', $deliverables->pluck('id'))
                    ->where('status', '!=', 'not_applicable')
                    ->count();
                $pCompletedActs = RoleActivity::whereIn('deliverable_id', $deliverables->pluck('id'))
                    ->whereIn('status', ['approved', 'delivered', 'in_review'])
                    ->count();

                $pApproved = $deliverables->where('global_status', 'finished')->count();
                $pDelayed = RoleActivity::whereHas('deliverable.subject.academicProgram', fn($q) => $q->where('project_id', $p->id))
                    ->whereNotNull('actual_delivery_date')->whereNotNull('commitment_date')
                    ->get()->filter(fn($a) => $a->actual_delivery_date > $a->commitment_date)->count();
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
