<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Services\WorkingDayService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkspaceController extends Controller
{
    private const OPERATIONAL_ROLES = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

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

        $totalDeliverables = Deliverable::count();
        $finishedDeliverables = Deliverable::where('global_status', 'finished')->count();

        $allActivities = RoleActivity::with('deliverable.subject.academicProgram.project')->get();
        $overdue = 0;
        $approaching = 0;

        foreach ($allActivities as $a) {
            if (!$a->commitment_date) continue;
            $status = WorkingDayService::getStatus(
                Carbon::parse($a->commitment_date),
                $a->actual_delivery_date ? Carbon::parse($a->actual_delivery_date) : null
            );
            if ($status === 'overdue') $overdue++;
            if ($status === 'approaching') $approaching++;
        }

        $recentActivities = RoleActivity::with('deliverable.subject.academicProgram.project', 'responsible')
            ->orderBy('updated_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'user'  => $user,
            'role'  => $role,
            'stats' => [
                'active_projects'  => $projects->count(),
                'total_deliverables' => $totalDeliverables,
                'finished_deliverables' => $finishedDeliverables,
                'overdue_activities' => $overdue,
                'approaching_activities' => $approaching,
            ],
            'projects'           => $projects,
            'recent_activities'  => $recentActivities,
        ]);
    }

    private function operationalWorkspace($user, $role)
    {
        $activities = RoleActivity::where('responsible_id', $user->id)
            ->with('deliverable.subject.academicProgram.project')
            ->get();

        $pending    = 0;
        $approaching = 0;
        $overdue    = 0;
        $completed  = 0;

        $mapped = $activities->map(function ($activity) use (&$pending, &$approaching, &$overdue, &$completed) {
            $dateStatus = 'on_time';
            if ($activity->commitment_date) {
                $dateStatus = WorkingDayService::getStatus(
                    Carbon::parse($activity->commitment_date),
                    $activity->actual_delivery_date ? Carbon::parse($activity->actual_delivery_date) : null
                );
            }

            if ($activity->status === 'approved') {
                $completed++;
            } elseif ($dateStatus === 'overdue') {
                $overdue++;
            } elseif ($dateStatus === 'approaching') {
                $approaching++;
            } else {
                $pending++;
            }

            $deliverable = $activity->deliverable;
            $subject     = $deliverable?->subject;
            $program     = $subject?->academicProgram;
            $project     = $program?->project;

            return [
                'id'             => $activity->id,
                'role'           => $activity->role,
                'status'         => $activity->status,
                'commitment_date'=> $activity->commitment_date?->toDateString(),
                'date_status'    => $dateStatus,
                'deliverable'    => $deliverable ? ['id' => $deliverable->id, 'name' => $deliverable->name, 'type' => $deliverable->type] : null,
                'subject'        => $subject ? ['id' => $subject->id, 'name' => $subject->name] : null,
                'program'        => $program ? ['id' => $program->id, 'name' => $program->name] : null,
                'project'        => $project ? ['id' => $project->id, 'name' => $project->name, 'status' => $project->status] : null,
            ];
        });

        $now = Carbon::now();
        $in30Days = $now->copy()->addDays(30);

        $calendarActivities = $mapped->filter(function ($a) use ($now, $in30Days) {
            if (!$a['commitment_date']) return false;
            $d = Carbon::parse($a['commitment_date']);
            return $d->between($now, $in30Days);
        })->values();

        return response()->json([
            'user'  => $user,
            'role'  => $role,
            'stats' => [
                'pending'    => $pending,
                'approaching' => $approaching,
                'overdue'    => $overdue,
                'completed'  => $completed,
            ],
            'activities'          => $mapped->values(),
            'calendar_activities' => $calendarActivities,
        ]);
    }
}
