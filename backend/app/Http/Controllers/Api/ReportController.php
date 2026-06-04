<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Services\WorkingDayService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
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
        $globalCompliance = $totalDeliverables > 0
            ? round(($finishedDeliverables / $totalDeliverables) * 100, 2)
            : 0;

        $activitiesByRole = RoleActivity::select('role', DB::raw('count(*) as total'),
            DB::raw("sum(case when status = 'approved' then 1 else 0 end) as approved"))
            ->groupBy('role')
            ->get();

        $activeProjects = Project::where('status', 'in_progress')->count();
        $totalPrograms = \App\Models\AcademicProgram::count();

        // Overdue and approaching
        $allActivities = RoleActivity::whereNotNull('commitment_date')->get();
        $overdueActivities = 0;
        $approachingActivities = 0;
        foreach ($allActivities as $a) {
            $status = WorkingDayService::getStatus(
                Carbon::parse($a->commitment_date),
                $a->actual_delivery_date ? Carbon::parse($a->actual_delivery_date) : null
            );
            if ($status === 'overdue') $overdueActivities++;
            if ($status === 'approaching') $approachingActivities++;
        }

        return response()->json([
            'active_projects'             => $activeProjects,
            'total_programs'              => $totalPrograms,
            'total_deliverables'          => $totalDeliverables,
            'finished_deliverables'       => $finishedDeliverables,
            'with_observations'           => $withObservations,
            'compliance_percentage'       => $globalCompliance,
            'overdue_activities'          => $overdueActivities,
            'approaching_activities'      => $approachingActivities,
            'projects_by_status'          => $projectsByStatus,
            'deliverables_by_status'      => $deliverablesByStatus,
            'global_compliance_percentage'=> $globalCompliance,
            'activities_by_role'          => $activitiesByRole,
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

        $total = $deliverables->count();
        $finished = $deliverables->where('global_status', 'finished')->count();
        $compliance = $total > 0 ? round(($finished / $total) * 100, 2) : 0;

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

        return response()->json([
            'total_deliverables' => $total,
            'finished_deliverables' => $finished,
            'compliance_percentage' => $compliance,
            'by_role' => $byRole,
        ]);
    }
}
